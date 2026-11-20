const buildSketch = (p) => {
  p.setup = () => {
    const div = document.getElementById("build-canvas");
    const c = p.createCanvas(div.clientWidth, div.clientHeight);
    c.parent("build-canvas");
  };

  p.draw = () => {
    p.background(240);
  };

  p.windowResized = () => {
    const div = document.getElementById("build-canvas");
    p.resizeCanvas(div.clientWidth, div.clientHeight);
  };
};

const stageSketch = (p) => {
  p.setup = () => {
    const div = document.getElementById("manipulate-stage");
    const c = p.createCanvas(div.clientWidth, div.clientHeight);
    c.parent("manipulate-stage");
  };

  p.draw = () => {
    p.background(255);
  };

  p.windowResized = () => {
    const div = document.getElementById("manipulate-stage");
    p.resizeCanvas(div.clientWidth, div.clientHeight);
  };
};

new p5(buildSketch);
new p5(stageSketch);

window.addEventListener("load", () => {
  window.dispatchEvent(new Event("resize"));
});