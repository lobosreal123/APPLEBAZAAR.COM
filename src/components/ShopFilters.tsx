import {
  CATEGORY_TABS,
  SUB_CATEGORIES,
  type CategoryTab,
} from '../utils/categoryFilter'

type Props = {
  activeTab: CategoryTab
  effectiveSub: string | null
  onSelectTab: (id: CategoryTab) => void
  onSelectSub: (id: string) => void
}

export default function ShopFilters({
  activeTab,
  effectiveSub,
  onSelectTab,
  onSelectSub,
}: Props) {
  const subTabs = activeTab !== 'all' ? SUB_CATEGORIES[activeTab] : []

  return (
    <aside className="shop-sidebar" aria-label="Shop categories and filters">
      <h2 className="shop-sidebar-heading">Browse</h2>
      <nav className="shop-sidebar-section" role="tablist" aria-label="Category">
        <p className="shop-sidebar-label">Category</p>
        <ul className="shop-sidebar-list">
          {CATEGORY_TABS.map(({ id, label }) => (
            <li key={id}>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                className={`shop-sidebar-btn shop-sidebar-btn-main ${activeTab === id ? 'active' : ''}`}
                onClick={() => onSelectTab(id)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {subTabs.length > 0 && (
        <nav
          className="shop-sidebar-section shop-sidebar-filters"
          role="tablist"
          aria-label={`${activeTab} filter`}
        >
          <p className="shop-sidebar-label shop-sidebar-label-filter">Filter</p>
          <ul className="shop-sidebar-list">
            {subTabs.map((sub) => (
              <li key={sub.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={effectiveSub === sub.id}
                  className={`shop-sidebar-btn shop-sidebar-btn-sub ${effectiveSub === sub.id ? 'active' : ''}`}
                  onClick={() => onSelectSub(sub.id)}
                >
                  {sub.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </aside>
  )
}
