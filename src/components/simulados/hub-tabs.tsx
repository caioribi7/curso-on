import { Segmented } from "@/components/motion/segmented";

/** Simulados ↔ Listas: same sliding indicator as the other tab bars. */
export function HubTabs({ active }: { active: "simulados" | "listas" }) {
  return (
    <Segmented
      name="hub-tab"
      label="Simulados e listas"
      active={active}
      items={[
        { key: "simulados", href: "/app/simulados", label: "Simulados" },
        { key: "listas", href: "/app/listas", label: "Listas de questões" },
      ]}
    />
  );
}
