// Presence chip ("You're a butterfly · 3 here") and rare, kind screen reader announcements.
import { $connection, $counts, $self } from "../core/stores.ts";
import { h } from "./dom.ts";
import { CREATURE, announceDelay, formatCount, othersSentence } from "./presence-text.ts";

const MIN_GAP_MS = 30_000;
/** Let the page finish being read before saying anything. */
const FIRST_DELAY_MS = 4_000;

export function installPresence(chip: HTMLElement, announcer: HTMLElement): void {
  const render = () => {
    const self = $self.get();
    const conn = $connection.get();
    const { online, totalVisitors } = $counts.get();
    if (!self) {
      chip.replaceChildren(conn === "offline" ? "Offline · the yard is all yours" : "Finding your wings…");
      return;
    }
    const creature = CREATURE[self.kind];
    const parts: Node[] = [
      h("span", { class: "presence__dot", style: `--c: ${self.color}`, "aria-hidden": "true" }),
      h("span", { class: "presence__you" }, `You're ${creature.name} `),
      h("span", { "aria-hidden": "true" }, creature.emoji),
    ];
    if (conn === "offline") parts.push(h("span", { class: "presence__more" }, "\u00a0· offline"));
    else {
      parts.push(h("span", { class: "presence__more" }, `\u00a0· ${formatCount(online)} here`));
      if (totalVisitors > 0) parts.push(h("span", { class: "presence__total" }, `\u00a0· ${formatCount(totalVisitors)} visited`));
    }
    chip.replaceChildren(...parts);
  };
  $self.subscribe(render);
  $counts.subscribe(render);
  $connection.subscribe(render);

  let lastAnnounced: number | null = null;
  let lastAt: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    timer = undefined;
    if ($connection.get() !== "online") return;
    const others = Math.max(0, $counts.get().online - 1);
    const sentence = othersSentence(others, lastAnnounced);
    lastAnnounced = others;
    if (!sentence) return;
    lastAt = performance.now();
    // Clear first so repeating the same words is still announced.
    announcer.textContent = "";
    requestAnimationFrame(() => (announcer.textContent = sentence));
  };

  const schedule = () => {
    if (timer !== undefined || $connection.get() !== "online") return;
    const others = Math.max(0, $counts.get().online - 1);
    if (others === lastAnnounced) return;
    const wait = lastAt === null ? FIRST_DELAY_MS : announceDelay(performance.now(), lastAt, MIN_GAP_MS);
    timer = setTimeout(flush, wait);
  };
  $counts.listen(schedule);
  $connection.listen(schedule);
}
