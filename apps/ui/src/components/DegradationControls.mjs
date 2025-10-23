// DegradationControls component - Handles degradation strategy switches (AC3)
// Implements sampling → field trimming → pause with explicit recovery conditions

import { minimalPanelStore } from '../stores/minimalPanelStore.mjs'

export class DegradationControls {
  constructor() {
    this.container = null
    this.unsubscribe = null
    this.elements = {}
  }

  init(container) {
    this.container = container
    this.render()
    this.setupEventListeners()
    this.subscribeToStore()
    return this
  }

  render() {
    this.container.innerHTML = `
      <div class="degradation-controls">
        <div class="control-group">
          <label class="switch-label">
            降级模式
            <span class="info-badge" title="自动根据性能调整降级级别">?</span>
          </label>
          <div class="degradation-switch">
            <input type="checkbox" id="degradation-toggle" />
            <label for="degradation-toggle" class="switch"></label>
          </div>
        </div>

        <div class="control-group">
          <label class="level-label">级别:</label>
          <span id="degradation-level" class="level-indicator">正常</span>
        </div>

        <div class="control-group">
          <label class="auto-label">
            自动恢复
            <span class="info-badge" title="FPS > 60 时自动降低降级级别">?</span>
          </label>
          <div class="auto-switch">
            <input type="checkbox" id="auto-recover" checked />
            <label for="auto-recover" class="switch small"></label>
          </div>
        </div>

        <div class="control-details" id="degradation-details">
          <div class="detail-item">
            <span class="detail-label">采样率:</span>
            <span id="sampling-rate">1/1</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">字段裁剪:</span>
            <span id="field-trimming">关</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">状态:</span>
            <span id="pause-status">运行中</span>
          </div>
        </div>

        <button id="manual-recover" class="recover-btn" style="display: none;">
          手动恢复
        </button>

        <style>
          .degradation-controls {
            display: flex;
            align-items: center;
            gap: 20px;
            padding: 8px 0;
          }

          .control-group {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .switch-label, .level-label, .auto-label {
            font-size: 14px;
            color: #24292e;
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .info-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #e1e4e8;
            color: #586069;
            font-size: 11px;
            cursor: help;
          }

          .degradation-switch, .auto-switch {
            position: relative;
          }

          .switch {
            position: relative;
            display: inline-block;
            width: 48px;
            height: 24px;
            background: #e1e4e8;
            border-radius: 24px;
            cursor: pointer;
            transition: background 0.3s;
          }

          .switch.small {
            width: 36px;
            height: 20px;
          }

          .switch::after {
            content: '';
            position: absolute;
            left: 2px;
            top: 2px;
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            transition: transform 0.3s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }

          .switch.small::after {
            width: 16px;
            height: 16px;
          }

          input[type="checkbox"] {
            display: none;
          }

          input[type="checkbox"]:checked + .switch {
            background: #f97316;
          }

          input[type="checkbox"]:checked + .switch::after {
            transform: translateX(24px);
          }

          input[type="checkbox"]:checked + .switch.small::after {
            transform: translateX(16px);
          }

          .level-indicator {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            background: #d4f4dd;
            color: #1a7f37;
          }

          .level-indicator.warning {
            background: #fff8dc;
            color: #9a6700;
          }

          .level-indicator.critical {
            background: #ffebe9;
            color: #cf222e;
          }

          .control-details {
            display: flex;
            gap: 16px;
            padding: 0 16px;
            border-left: 1px solid #e1e4e8;
          }

          .detail-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 13px;
          }

          .detail-label {
            color: #586069;
          }

          .detail-item span:last-child {
            color: #24292e;
            font-weight: 500;
          }

          .recover-btn {
            padding: 6px 12px;
            background: #2ea043;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: background 0.2s;
          }

          .recover-btn:hover {
            background: #2c974b;
          }
        </style>
      </div>
    `

    // Cache element references
    this.elements = {
      degradationToggle: this.container.querySelector('#degradation-toggle'),
      autoRecover: this.container.querySelector('#auto-recover'),
      levelIndicator: this.container.querySelector('#degradation-level'),
      samplingRate: this.container.querySelector('#sampling-rate'),
      fieldTrimming: this.container.querySelector('#field-trimming'),
      pauseStatus: this.container.querySelector('#pause-status'),
      manualRecover: this.container.querySelector('#manual-recover'),
      details: this.container.querySelector('#degradation-details')
    }
  }

  setupEventListeners() {
    // Degradation toggle
    this.elements.degradationToggle.addEventListener('change', (e) => {
      minimalPanelStore.toggleDegradation(e.target.checked)
    })

    // Auto-recover toggle
    this.elements.autoRecover.addEventListener('change', (e) => {
      minimalPanelStore.updateState({
        degradation: {
          ...minimalPanelStore.getState().degradation,
          autoRecover: e.target.checked
        }
      })
    })

    // Manual recover button
    this.elements.manualRecover.addEventListener('click', () => {
      minimalPanelStore.setDegradationLevel(0)
      this.elements.degradationToggle.checked = false
    })
  }

  subscribeToStore() {
    this.unsubscribe = minimalPanelStore.subscribe((state) => {
      this.updateUI(state.degradation)
    })
  }

  updateUI(degradation) {
    const { level, samplingRate, fieldTrimming, isPaused, autoRecover } = degradation

    // Update level indicator
    const levelText = ['正常', '采样降频', '字段裁剪', '已暂停'][level]
    const levelClass = ['', 'warning', 'warning', 'critical'][level]

    this.elements.levelIndicator.textContent = levelText
    this.elements.levelIndicator.className = `level-indicator ${levelClass}`

    // Update sampling rate
    if (samplingRate === 0) {
      this.elements.samplingRate.textContent = '停止'
    } else if (samplingRate === 1) {
      this.elements.samplingRate.textContent = '1/1'
    } else {
      this.elements.samplingRate.textContent = `1/${Math.round(1/samplingRate)}`
    }

    // Update field trimming
    this.elements.fieldTrimming.textContent = fieldTrimming ? '开' : '关'

    // Update pause status
    this.elements.pauseStatus.textContent = isPaused ? '已暂停' : '运行中'
    this.elements.pauseStatus.style.color = isPaused ? '#cf222e' : '#1a7f37'

    // Update auto-recover checkbox
    this.elements.autoRecover.checked = autoRecover

    // Show/hide manual recover button
    this.elements.manualRecover.style.display = level > 0 && !autoRecover ? 'block' : 'none'

    // Update toggle state
    if (level > 0 && !this.elements.degradationToggle.checked) {
      this.elements.degradationToggle.checked = true
    } else if (level === 0 && this.elements.degradationToggle.checked) {
      this.elements.degradationToggle.checked = false
    }

    // Add visual feedback for critical state
    if (level === 3) {
      this.container.style.borderLeft = '3px solid #cf222e'
      this.container.style.paddingLeft = '8px'
    } else if (level > 0) {
      this.container.style.borderLeft = '3px solid #f97316'
      this.container.style.paddingLeft = '8px'
    } else {
      this.container.style.borderLeft = 'none'
      this.container.style.paddingLeft = '0'
    }
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe()
    }
    this.container.innerHTML = ''
  }
}