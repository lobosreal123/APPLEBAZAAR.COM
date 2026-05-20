import { useEffect, useCallback, type MouseEvent } from 'react'
import { useShopCategory } from '../contexts/ShopCategoryContext'
import {
  CATEGORY_TABS,
  SUB_CATEGORIES,
} from '../utils/categoryFilter'

/** Opens category drawer (icon beside search in header). */
export function ShopCategoryToggle() {
  const { drawerOpen, toggleDrawer } = useShopCategory()

  return (
    <button
      type="button"
      className="shop-filters-toggle shop-filters-toggle--icon-only"
      aria-expanded={drawerOpen}
      aria-controls="shop-category-drawer"
      aria-label={drawerOpen ? 'Close categories' : 'Open categories'}
      onClick={toggleDrawer}
    >
      <span className="shop-filters-toggle-bars" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </button>
  )
}

export function ShopCategoryDrawer() {
  const {
    activeTab,
    effectiveSub,
    drawerOpen,
    setDrawerOpen,
    selectTab,
    selectSub,
  } = useShopCategory()

  const close = useCallback(() => setDrawerOpen(false), [setDrawerOpen])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [drawerOpen, close])

  const handleTab = (e: MouseEvent, id: typeof activeTab) => {
    e.stopPropagation()
    selectTab(id)
    if (id === 'all') close()
  }

  const handleSub = (e: MouseEvent, id: string) => {
    e.stopPropagation()
    selectSub(id)
    close()
  }

  return (
    <>
      <div
        className={`shop-sidebar-backdrop ${drawerOpen ? 'visible' : ''}`}
        aria-hidden={!drawerOpen}
        onClick={close}
      />
      <aside
        id="shop-category-drawer"
        className={`shop-sidebar ${drawerOpen ? 'open' : ''}`}
        aria-label="Shop categories and filters"
        aria-hidden={!drawerOpen}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shop-sidebar-header">
          <h2 className="shop-sidebar-heading">Browse</h2>
          <button
            type="button"
            className="shop-sidebar-close"
            aria-label="Close categories"
            onClick={close}
          >
            ×
          </button>
        </div>
        <nav className="shop-sidebar-section" aria-label="Categories and filters">
          <ul className="shop-sidebar-list shop-sidebar-tree">
            {CATEGORY_TABS.map(({ id, label }) => {
              const isActive = activeTab === id
              const subTabs = id !== 'all' ? SUB_CATEGORIES[id] : []
              return (
                <li
                  key={id}
                  className={`shop-sidebar-group ${isActive ? 'expanded' : ''}`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-expanded={isActive && subTabs.length > 0}
                    className={`shop-sidebar-btn shop-sidebar-btn-main ${isActive ? 'active' : ''}`}
                    onClick={(e) => handleTab(e, id)}
                  >
                    {label}
                  </button>
                  {isActive && subTabs.length > 0 && (
                    <ul
                      className="shop-sidebar-sublist"
                      role="tablist"
                      aria-label={`${label} filters`}
                    >
                      {subTabs.map((sub) => (
                        <li key={sub.id}>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={effectiveSub === sub.id}
                            className={`shop-sidebar-btn shop-sidebar-btn-sub ${effectiveSub === sub.id ? 'active' : ''}`}
                            onClick={(e) => handleSub(e, sub.id)}
                          >
                            {sub.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}
