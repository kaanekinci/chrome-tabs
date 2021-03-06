(function(){
  const isNodeContext = typeof module !== 'undefined' && typeof module.exports !== 'undefined'
  const Draggabilly = isNodeContext ? require('draggabilly') : window.Draggabilly

  const TAB_EFFECTIVE_ADJACENT_SPACE = 9
  const TAB_OVERLAP_DISTANCE = (TAB_EFFECTIVE_ADJACENT_SPACE * 2) + 1

  const TAB_MIN_WIDTH = 24 + (TAB_EFFECTIVE_ADJACENT_SPACE * 2)
  const TAB_MAX_WIDTH = 240 + (TAB_EFFECTIVE_ADJACENT_SPACE * 2)

  const TAB_SIZE_SMALL = 84
  const TAB_SIZE_SMALLER = 60
  const TAB_SIZE_MINI = 48

  const tabTemplate = `
    <div class="chrome-tab" style="--effective-adjacent-space: ${ TAB_EFFECTIVE_ADJACENT_SPACE }px">
      <div class="chrome-tab-dividers"></div>
      <div class="chrome-tab-background">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg"><defs><symbol id="chrome-tab-geometry-left" viewBox="0 0 214 34" ><path d="M17 0h197v34H0c5 0 9-3 9-8V8c0-5 3-8 8-8z"/></symbol><symbol id="chrome-tab-geometry-right" viewBox="0 0 214 34"><use xlink:href="#chrome-tab-geometry-left"/></symbol><clipPath id="crop"><rect class="mask" width="100%" height="100%" x="0"/></clipPath></defs><svg width="50%" height="100%"><use xlink:href="#chrome-tab-geometry-left" width="214" height="34" class="chrome-tab-geometry"/></svg><g transform="scale(-1, 1)"><svg width="50%" height="100%" x="-100%" y="0"><use xlink:href="#chrome-tab-geometry-right" width="214" height="34" class="chrome-tab-geometry"/></svg></g></svg>
      </div>
      <div class="chrome-tab-content">
        <div class="chrome-tab-favicon"></div>
        <div class="chrome-tab-title"></div>
        <div class="chrome-tab-drag-handle"></div>
        <div class="chrome-tab-close"></div>
      </div>
    </div>
  `

  const defaultTapProperties = {
    title: 'New tab',
    favicon: false
  }

  let instanceId = 0

  class ChromeTabs {
    constructor() {
      this.draggabillyInstances = []
    }

    init(el) {
      this.el = el

      this.instanceId = instanceId
      this.el.setAttribute('data-chrome-tabs-instance-id', this.instanceId)
      instanceId += 1

      this.setupStyleEl()
      this.setupEvents()
      this.layoutTabs()
      this.setupDraggabilly()
    }

    emit(eventName, data) {
      this.el.dispatchEvent(new CustomEvent(eventName, { detail: data }))
    }

    setupStyleEl() {
      this.styleEl = document.createElement('style')
      this.el.appendChild(this.styleEl)
    }

    setupEvents() {
      window.addEventListener('resize', _ => this.layoutTabs())

      this.el.addEventListener('dblclick', event => {
        if ([this.el, this.tabContentEl].includes(event.target)) this.addTab()
      })

      this.tabEls.forEach((tabEl) => this.setTabCloseEventListener(tabEl))
    }

    get tabEls() {
      return Array.prototype.slice.call(this.el.querySelectorAll('.chrome-tab'))
    }

    get tabContentEl() {
      return this.el.querySelector('.chrome-tabs-content')
    }

    get tabWidth() {
      const tabsContentWidth = this.tabContentEl.clientWidth - TAB_OVERLAP_DISTANCE
      const width = (tabsContentWidth / this.tabEls.length) + TAB_OVERLAP_DISTANCE
      const clampedWidth = Math.max(TAB_MIN_WIDTH, Math.min(TAB_MAX_WIDTH, width))

      // TODO
      // We round here to fix issue with tab dividers poking out from underneath
      // the tab background / Would be better to find an alternative solution
      return Math.round(clampedWidth)
    }

    get tabEffectiveWidth() {
      return this.tabWidth - TAB_OVERLAP_DISTANCE
    }

    get tabPositions() {
      const tabEffectiveWidth = this.tabEffectiveWidth
      let left = 0
      let positions = []

      this.tabEls.forEach((tabEl, i) => {
        positions.push(left)
        left += tabEffectiveWidth
      })
      return positions
    }

    layoutTabs() {
      const tabWidth = this.tabWidth
      const tabEffectiveWidth = this.tabEffectiveWidth

      this.cleanUpPreviouslyDraggedTabs()
      this.tabEls.forEach((tabEl) => {
        // TODO - Support tabs with different widths / e.g. "pinned" tabs
        tabEl.style.width = tabWidth + 'px'

        tabEl.removeAttribute('is-small')
        tabEl.removeAttribute('is-smaller')
        tabEl.removeAttribute('is-mini')
        if (tabEffectiveWidth < TAB_SIZE_SMALL) tabEl.setAttribute('is-small', '')
        if (tabEffectiveWidth < TAB_SIZE_SMALLER) tabEl.setAttribute('is-smaller', '')
        if (tabEffectiveWidth < TAB_SIZE_MINI) tabEl.setAttribute('is-mini', '')
      })

      let styleHTML = ''
      this.tabPositions.forEach((left, i) => {
        styleHTML += `
          .chrome-tabs[data-chrome-tabs-instance-id="${ this.instanceId }"] .chrome-tab:nth-child(${ i + 1 }) {
            transform: translate3d(${ left }px, 0, 0)
          }
        `
      })
      this.styleEl.innerHTML = styleHTML
    }

    createNewTabEl() {
      const div = document.createElement('div')
      div.innerHTML = tabTemplate
      return div.firstElementChild
    }

    addTab(tabProperties) {
      const tabEl = this.createNewTabEl()

      tabEl.classList.add('chrome-tab-just-added')
      setTimeout(() => tabEl.classList.remove('chrome-tab-just-added'), 500)

      tabProperties = Object.assign({}, defaultTapProperties, tabProperties)
      this.tabContentEl.appendChild(tabEl)
      this.setTabCloseEventListener(tabEl)
      this.updateTab(tabEl, tabProperties)
      this.emit('tabAdd', { tabEl })
      this.setCurrentTab(tabEl)
      this.layoutTabs()
      this.setupDraggabilly()
    }

    setTabCloseEventListener(tabEl) {
      tabEl.querySelector('.chrome-tab-close').addEventListener('click', _ => this.removeTab(tabEl))
    }

    setCurrentTab(tabEl) {
      const currentTab = this.el.querySelector('.chrome-tab-current')
      if (currentTab === tabEl) return
      if (currentTab) currentTab.classList.remove('chrome-tab-current')
      tabEl.classList.add('chrome-tab-current')
      this.emit('activeTabChange', { tabEl })
    }

    removeTab(tabEl) {
      if (tabEl.classList.contains('chrome-tab-current')) {
        if (tabEl.nextElementSibling) {
          this.setCurrentTab(tabEl.nextElementSibling)
        } else if (tabEl.previousElementSibling) {
          this.setCurrentTab(tabEl.previousElementSibling)
        }
      }
      tabEl.parentNode.removeChild(tabEl)
      this.emit('tabRemove', { tabEl })
      this.layoutTabs()
      this.setupDraggabilly()
    }

    updateTab(tabEl, tabProperties) {
      tabEl.querySelector('.chrome-tab-title').textContent = tabProperties.title

      const faviconEl = tabEl.querySelector('.chrome-tab-favicon')
      if (tabProperties.favicon) {
        faviconEl.style.backgroundImage = `url('${ tabProperties.favicon }')`
      } else {
        faviconEl.remove()
      }
    }

    cleanUpPreviouslyDraggedTabs() {
      this.tabEls.forEach((tabEl) => tabEl.classList.remove('chrome-tab-just-dragged'))
    }

    setupDraggabilly() {
      const tabEls = this.tabEls
      const tabEffectiveWidth = this.tabEffectiveWidth
      const tabPositions = this.tabPositions

      this.draggabillyInstances.forEach(draggabillyInstance => draggabillyInstance.destroy())

      tabEls.forEach((tabEl, originalIndex) => {
        const originalTabPositionX = tabPositions[originalIndex]
        const draggabillyInstance = new Draggabilly(tabEl, {
          axis: 'x',
          handle: '.chrome-tab-drag-handle',
          containment: this.tabContentEl
        })

        this.draggabillyInstances.push(draggabillyInstance)

        draggabillyInstance.on('pointerDown', () => {
          this.setCurrentTab(tabEl)
        })

        draggabillyInstance.on('dragStart', () => {
          this.cleanUpPreviouslyDraggedTabs()
          tabEl.classList.add('chrome-tab-currently-dragged')
          this.el.classList.add('chrome-tabs-sorting')
        })

        draggabillyInstance.on('dragEnd', () => {
          const finalTranslateX = parseFloat(tabEl.style.left, 10)
          tabEl.style.transform = `translate3d(0, 0, 0)`

          // Animate dragged tab back into its place
          requestAnimationFrame(() => {
            tabEl.style.left = '0'
            tabEl.style.transform = `translate3d(${ finalTranslateX }px, 0, 0)`

            requestAnimationFrame(() => {
              tabEl.classList.remove('chrome-tab-currently-dragged')
              this.el.classList.remove('chrome-tabs-sorting')

              tabEl.classList.add('chrome-tab-just-dragged')

              requestAnimationFrame(() => {
                tabEl.style.transform = ''

                this.setupDraggabilly()
              })
            })
          })
        })

        draggabillyInstance.on('dragMove', (event, pointer, moveVector) => {
          // Current index be computed within the event since it can change during the dragMove
          const tabEls = this.tabEls
          const currentIndex = tabEls.indexOf(tabEl)

          const currentTabPositionX = originalTabPositionX + moveVector.x
          const destinationIndex = Math.max(0, Math.min(tabEls.length, Math.floor((currentTabPositionX + (tabEffectiveWidth / 2)) / tabEffectiveWidth)))

          if (currentIndex !== destinationIndex) {
            this.animateTabMove(tabEl, currentIndex, destinationIndex)
          }
        })
      })
    }

    animateTabMove(tabEl, originIndex, destinationIndex) {
      if (destinationIndex < originIndex) {
        tabEl.parentNode.insertBefore(tabEl, this.tabEls[destinationIndex])
      } else {
        tabEl.parentNode.insertBefore(tabEl, this.tabEls[destinationIndex + 1])
      }
    }
  }

  if (isNodeContext) {
    module.exports = ChromeTabs
  } else {
    window.ChromeTabs = ChromeTabs
  }
})()
