export type TabId = "camera" | "telegram";

type Props = {
  active: TabId;
  onChange: (tab: TabId) => void;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "camera", label: "Camera" },
  { id: "telegram", label: "Telegram" },
];

export default function TabBar({ active, onChange }: Props) {
  return (
    <div className="tab-bar" role="tablist" aria-label="Instrument mode">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`tab-bar__tab${active === tab.id ? " tab-bar__tab--active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
