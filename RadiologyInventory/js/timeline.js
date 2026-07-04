const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function renderTimeline({ year, month, onSelect, onYearChange }) {
  const wrapper = document.createElement("section");
  wrapper.className = "month-card";
  wrapper.innerHTML = `
    <div class="section-head">
      <h2>${year}</h2>
      <div class="year-stepper">
        <button class="icon-btn" type="button" data-month-step="-1" aria-label="上一月"><span class="material-symbols-rounded">chevron_left</span></button>
        <span>目前月份 ${String(month).padStart(2, "0")}</span>
        <button class="icon-btn" type="button" data-month-step="1" aria-label="下一月"><span class="material-symbols-rounded">chevron_right</span></button>
      </div>
    </div>
    <div class="history-timeline">
      <div class="month-track" aria-label="月份時間軸"></div>
      <input class="history-range" type="range" min="1" max="12" step="1" value="${month}" aria-label="歷史月份滑桿">
    </div>
  `;
  const track = wrapper.querySelector(".month-track");
  MONTH_LABELS.forEach((label, index) => {
    const value = index + 1;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `month-chip${value === month ? " active" : ""}`;
    button.textContent = label;
    button.addEventListener("click", () => onSelect(value));
    track.append(button);
  });
  wrapper.querySelectorAll("[data-month-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextMonth = month + Number(button.dataset.monthStep);
      if (nextMonth < 1) {
        onYearChange(-1);
        onSelect(12);
        return;
      }
      if (nextMonth > 12) {
        onYearChange(1);
        onSelect(1);
        return;
      }
      onSelect(nextMonth);
    });
  });
  wrapper.querySelector(".history-range").addEventListener("input", (event) => {
    onSelect(Number(event.currentTarget.value));
  });
  requestAnimationFrame(() => {
    track.querySelector(".active")?.scrollIntoView({ inline: "center", block: "nearest" });
  });
  return wrapper;
}
