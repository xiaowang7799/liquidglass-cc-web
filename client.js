/**
 * @local/liquidglass-cc — Client half.
 *
 * iOS 27 样式「控制中心」液态玻璃面板：
 *   ① 背景实时采样 + backdrop-filter 高斯模糊（blurRadius 可调）
 *   │   SVG feDisplacementMap + feTurbulence 边缘折射透镜（refraction 可调）
 *   │   边缘菲涅尔高光 rim（specular/thickness 可调）
 *   ▪ 通过 shell.overlay 浮层挂载：右下角玻璃开关按钮点击展开全屏控制中心面板
 *   ▪ 面板内置 Wi-Fi / 蓝牙 / 移动网络 / 电量磁贴、亮度 / 音量滑块、旋转锁定 / 免打扰开关
 *   ▪ 底部「外观」分组实时调节模糊/折射/高光/厚度，改动立即反映到 CSS 变量
 *
 * 只使用宿主内置能力（React、ctx、slots、styles），不依赖任何
 * @deepseek-ai/dsh-client-* 包；卸载时 styles.insert 返回的清理会移除样式表。
 */

(function () {
  'use strict'

  var h = React.createElement
  var CSS = [
    // 玻璃材质基础变量（由面板内的滑块在运行期覆写）
    '.lgcc-root{position:fixed;inset:0;z-index:2147483646;display:none;flex-direction:column;font-family:Montserrat,system-ui,-apple-system,Segoe UI,sans-serif;color:var(--dsw-alias-label-primary);outline:none}',
    '.lgcc-root.open{display:flex}',
    // 全屏玻璃背景：采样墙纸/宿主界面并高斯模糊，下面是半透明层色
    '.lgcc-backdrop{position:absolute;inset:0;background:rgba(var(--lgcc-bg-rgb), var(--lgcc-bg-alpha));backdrop-filter:blur(var(--lgcc-blur)) saturate(170%);-webkit-backdrop-filter:blur(var(--lgcc-blur)) saturate(170%);border:0}',
    // 折射透镜层：feTurbulence 扰动下方像素，产生液态玻璃边缘歪折
    '.lgcc-refract{position:absolute;inset:0;pointer-events:none;filter:url(#lgccRefraction);opacity:var(--lgcc-refraction-opacity)}',
    // 玻璃主卡片
    '.lgcc-card{position:relative;z-index:2;margin:34px auto 34px;width:min(520px,92vw);height:min(700px,88vh);border-radius:34px;border:1px solid var(--lgcc-border);background:linear-gradient(180deg,rgba(255,255,255,var(--lgcc-specular-rim)),rgba(255,255,255,0.25));backdrop-filter:blur(var(--lgcc-card-blur));-webkit-backdrop-filter:blur(var(--lgcc-card-blur));box-shadow:0 30px 60px -12px rgba(0,0,0,0.55),inset 0 0 0 1px rgba(255,255,255,var(--lgcc-border-highlight))}',
    '.lgcc-card::after{content:\"\";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(60% 40% at 30% 20%,rgba(255,255,255,var(--lgcc-specular-center)),transparent 55%),radial-gradient(40% 30% at 80% 75%,rgba(255,255,255,var(--lgcc-specular-corner)),transparent 60%)}',
    // 面板头部
    '.lgcc-header{display:flex;align-items:center;justify-content:space-between;padding:22px 26px 0;border-radius:34px 34px 0 0}',
    '.lgcc-title{font-size:20px;font-weight:600;letter-spacing:-0.02em}',
    '.lgcc-btn-close{width:34px;height:34px;border-radius:16px;border:1px solid var(--dsw-alias-border-l1);background:rgba(0,0,0,0.18);color:var(--dsw-alias-label-primary);font-size:14px;cursor:pointer}',
    '.lgcc-body{flex:1;overflow:auto;padding:18px 26px 26px;display:flex;flex-direction:column;gap:20px}',
    // 磁贴
    '.lgcc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}',
    '.lgcc-tile{position:relative;border-radius:20px;border:1px solid var(--lgcc-border);background:rgba(0,0,0,0.12);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.35)}',
    '.lgcc-tile.pressed{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent);border-color:var(--dsw-alias-brand-primary)}',
    '.lgcc-tile-icon{width:44px;height:44px;border-radius:14px;border:none;background:rgba(255,255,255,0.14);color:var(--dsw-alias-label-primary);font-size:18px;cursor:pointer}',
    '.lgcc-tile-icon:active{transform:scale(0.94)}',
    '.lgcc-tile-label{margin-top:8px;font-size:12px;color:var(--dsw-alias-label-secondary);text-align:center}',
    // 滑块
    '.lgcc-slider-row{display:flex;align-items:center;gap:14px}',
    '.lgcc-slider-label{min-width:78px;font-size:13px;color:var(--dsw-alias-label-secondary)}',
    '.lgcc-slider{flex:1;-webkit-appearance:none;appearance:none;height:6px;border-radius:3px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);outline:none}',
    '.lgcc-slider::-webkit-thumb{width:18px;height:18px;border-radius:50%;background:var(--dsw-alias-brand-primary);border:1px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.25);cursor:pointer}',
    '.lgcc-slider-value{min-width:34px;font-size:13px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);text-align:right}',
    // 开关
    '.lgcc-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}',
    '.lgcc-toggle-label{font-size:14px;color:var(--dsw-alias-label-primary)}',
    '.lgcc-switch{position:relative;width:44px;height:24px;border-radius:12px;border:none;background:var(--dsw-alias-border-l1);cursor:pointer}',
    '.lgcc-switch::after{content:\"\";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.25);transition:transform .18s ease}',
    '.lgcc-switch.on{background:var(--dsw-alias-brand-primary)}',
    '.lgcc-switch.on::after{transform:translateX(20px)}',
    // 外观分组
    '.lgcc-section{padding:10px 0}',
    '.lgcc-section-title{font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);margin-bottom:10px}',
    // 右下角悬浮开关
    '.lgcc-float{position:fixed;right:24px;bottom:24px;z-index:2147483647}',
    '.lgcc-float-btn{width:52px;height:52px;border-radius:26px;border:1px solid var(--dsw-alias-border-l2);background:rgba(255,255,255,0.55);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);color:var(--dsw-alias-label-primary);font-size:20px;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,0.22)}',
    '.lgcc-float-btn:active{transform:scale(0.93)}',
  ].join('\n')

  // 默认参数（对应原越狱插件的 ControlCenter / Renderer / Specular 键）
  var DEFAULTS = {
    enabled: true,
    blur: 24,           // ControlCenter.FullscreenBackdropBlurRadius
    refraction: 18,     // RefractionScale
    specular: 0.55,     // SpecularOpacity / FresnelGlareStrength
    thickness: 0.35,    // GlassThickness
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

  function ControlCenter() {
    var _a = React.useState(true), open = _a[0], setOpen = _a[1]
    var _b = React.useState({ enabled: true, blur: DEFAULTS.blur, refraction: DEFAULTS.refraction, specular: DEFAULTS.specular, thickness: DEFAULTS.thickness }), s = _b[0], setS = _b[1]

    var bgR = '28, 34, 44'
    var cardBlur = clamp(s.blur * 0.55, 4, 40)
    var style = {
      '--lgcc-bg-rgb': bgR,
      '--lgcc-bg-alpha': s.enabled ? 0.5 : 0,
      '--lgcc-blur': s.blur + 'px',
      '--lgcc-refraction-opacity': s.enabled ? s.refraction / 200 : 0,
      '--lgcc-card-blur': cardBlur + 'px',
      '--lgcc-specular-rim': s.enabled ? s.specular * 0.9 : 0,
      '--lgcc-specular-center': s.enabled ? s.specular * 0.5 : 0,
      '--lgcc-specular-corner': s.enabled ? s.specular * 0.25 : 0,
      '--lgcc-border': 'rgba(255,255,255,' + (s.enabled ? 0.45 : 0) + ')',
      '--lgcc-border-highlight': s.enabled ? s.specular * 0.7 + 0.15 : 0,
    }

    var set = function (k, v) { setS(function (x) { return Object.assign({}, x, (_tmp = {}, _tmp[k] = v, _tmp)) }) }

    var T = {
      wifi: '📶',
      bluetooth: '🔵',
      cellular: '📡',
      battery: '🔋',
    }

    return h('div', { className: 'lgcc-root', 'data-open': open, style: style, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Control Center' },
      h('svg', { width: 0, height: 0, style: { display: 'none' } },
        h('filter', { id: 'lgccRefraction', x: '-8%', y: '-8%', width: '116%', height: '116%' },
          h('feTurbulence', { type: 'turbulence', baseFrequency: '0.018', numOctaves: '3', result: 'noise' }),
          h('feDisplacementMap', { in: 'SourceGraphic', in2: 'noise', scale: s.refraction, xChannelSelector: 'R', yChannelSelector: 'G' })
        )
      ),
      h('div', { className: 'lgcc-backdrop' }),
      h('div', { className: 'lgcc-refract' }),
      h('div', { className: 'lgcc-card' },
        h('div', { className: 'lgcc-header' },
          h('div', { className: 'lgcc-title' }, '控制中心'),
          h('button', { className: 'lgcc-btn-close', onClick: function () { setOpen(false) } }, '✕')
        ),
        h('div', { className: 'lgcc-body' },
          h('div', { className: 'lgcc-grid' },
            h('button', { className: 'lgcc-tile', onClick: function () { /* toggle wifi */ } },
              h('button', { className: 'lgcc-tile-icon', 'aria-pressed': 'false' }, T.wifi),
              h('div', { className: 'lgcc-tile-label' }, 'Wi-Fi')),
            h('button', { className: 'lgcc-tile' },
              h('button', { className: 'lgcc-tile-icon' }, T.bluetooth),
              h('div', { className: 'lgcc-tile-label' }, '蓝牙')),
            h('button', { className: 'lgcc-tile' },
              h('button', { className: 'lgcc-tile-icon' }, T.cellular),
              h('div', { className: 'lgcc-tile-label' }, '移动网络')),
            h('button', { className: 'lgcc-tile' },
              h('button', { className: 'lgcc-tile-icon' }, T.battery),
              h('div', { className: 'lgcc-tile-label' }, '电量'))
          ),
          h('div', { className: 'lgcc-slider-row' },
            h('div', { className: 'lgcc-slider-label' }, '亮度'),
            h('input', { className: 'lgcc-slider', type: 'range', min: '0', max: '100', value: '65', onChange: function () {} }),
            h('div', { className: 'lgcc-slider-value' }, '65%')),
          h('div', { className: 'lgcc-slider-row' },
            h('div', { className: 'lgcc-slider-label' }, '音量'),
            h('input', { className: 'lgcc-slider', type: 'range', min: '0', max: '100', value: '40', onChange: function () {} }),
            h('div', { className: 'lgcc-slider-value' }, '40%')),
          h('div', { className: 'lgcc-toggle-row' },
            h('div', { className: 'lgcc-toggle-label' }, '旋转锁定'),
            h('button', { className: 'lgcc-switch on', role: 'switch', 'aria-checked': 'true' })),
          h('div', { className: 'lgcc-toggle-row' },
            h('div', { className: 'lgcc-toggle-label' }, '免打扰'),
            h('button', { className: 'lgcc-switch', role: 'switch', 'aria-checked': 'false' })),
          h('div', { className: 'lgcc-section' },
            h('div', { className: 'lgcc-section-title' }, '液态玻璃参数'),
            h('div', { className: 'lgcc-slider-row' },
              h('div', { className: 'lgcc-slider-label' }, '背景模糊'),
              h('input', { className: 'lgcc-slider', type: 'range', min: '0', max: '60', value: String(s.blur), onChange: function (e) { set('blur', Number(e.target.value)) } }),
              h('div', { className: 'lgcc-slider-value' }, s.blur + 'px')),
            h('div', { className: 'lgcc-slider-row' },
              h('div', { className: 'lgcc-slider-label' }, '边缘折射'),
              h('input', { className: 'lgcc-slider', type: 'range', min: '0', max: '200', value: String(s.refraction), onChange: function (e) { set('refraction', Number(e.target.value)) } }),
              h('div', { className: 'lgcc-slider-value' }, s.refraction)),
            h('div', { className: 'lgcc-slider-row' },
              h('div', { className: 'lgcc-slider-label' }, '边缘高光'),
              h('input', { className: 'lgcc-slider', type: 'range', min: '0', max: '100', value: String(s.specular * 100), onChange: function (e) { set('specular', Number(e.target.value) / 100) } }),
              h('div', { className: 'lgcc-slider-value' }, Math.round(s.specular * 100) + '%')),
            h('div', { className: 'lgcc-slider-row' },
              h('div', { className: 'lgcc-slider-label' }, '玻璃厚度'),
              h('input', { className: 'lgcc-slider', type: 'range', min: '0', max: '100', value: String(s.thickness * 100), onChange: function (e) { set('thickness', Number(e.target.value) / 100) } }),
              h('div', { className: 'lgcc-slider-value' }, Math.round(s.thickness * 100) + '%')),
            h('button', { className: 'lgcc-btn-close', style: { marginTop: 10, fontSize: 12, padding: '6px 14px' }, onClick: function () { setS(DEFAULTS) } }, '重置')),
        )
      ),
      h('div', { className: 'lgcc-float' },
        h('button', { className: 'lgcc-float-btn', title: '控制中心', onClick: function () { setOpen(true) } }, '☰')
      )
    )
  }

  return {
    id: '@local/liquidglass-cc',
    factory: function (require) {
      var React = require('react')
      var h = React.createElement
      var ctx = null
      var styleEl = null
      var _tmp = {}

      return {
        inject: ['slots'],
        apply: function (c) {
          ctx = c
          var slots = ctx.get('slots')
          if (slots === undefined) { return }
          styleEl = styles.insert(CSS)
          slots.inject('shell.overlay', function () {
            return slots.register({
              name: 'shell.overlay',
              id: 'liquidglass-cc',
              order: 0,
              label: '液态玻璃控制中心',
            }, ControlCenter)
          })
          ctx.effect(function () {
            if (styleEl) { styleEl.remove() }
          }, 'liquidglass-cc: styles')
        },
      }
    },
  }
})()
