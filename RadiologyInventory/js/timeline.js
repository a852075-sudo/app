const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function renderTimeline({ year, month, onSelect, onYearChange }) {
  const wrapper = document.createElement("section");
  wrapper.className = "month-card";
  wrapper.innerHTML = `
    <div class="section-head">
      <h2>${year}</h2>
      <div class="year-stepper">
        <button class="icon-btn" type="button" data-year="-1" aria-label="上一年"><span class="material-symbols-rounded">chevron_left</span></button>
        <span>目前月份 ${String(month).padStart(2, "0")}</span>
        <button class="icon-btn" type="button" data-year="1" aria-label="下一年"><span class="material-symbols-rounded">chevron_right</span></button>
      </div>
    </div>
    <div class="month-track" aria-label="月份時間軸"></div>
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
  wrapper.querySelectorAll("[data-year]").forEach((button) => {
    button.addEventListener("click", () => onYearChange(Number(button.dataset.year)));
  });
  requestAnimationFrame(() => {
    track.querySelector(".active")?.scrollIntoView({ inline: "center", block: "nearest" });
  });
  return wrapper;
}
