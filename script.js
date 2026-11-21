const slider = document.querySelector(".build__slider");
const list  = document.querySelector(".instructions__list");

function updateProgress() {
	list.style.setProperty("--progress", slider.value / slider.max);
}

slider.addEventListener("input", updateProgress);
updateProgress();