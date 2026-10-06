import fs from "node:fs";
import path from "node:path";

const publicDir = "./public";
const files = fs
	.readdirSync(publicDir)
	.filter((f) => f.endsWith(".webp") && !f.includes(".dark."));

let html = `<html>
<head>
<style>
  body { font-family: sans-serif; background: #e2e8f0; padding: 20px; }
  h1 { text-align: center; color: #333; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
  .card { background: #fff; padding: 15px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
  .card h3 { margin-top: 0; color: #555; font-size: 16px; }
  .images { display: flex; justify-content: space-around; }
  .img-box { display: flex; flex-direction: column; align-items: center; }
  .img-box p { margin: 5px 0; font-weight: bold; color: #777; font-size: 14px; }
  img { width: 120px; height: 120px; border-radius: 16px; border: 1px solid #ddd; object-fit: cover; }
  .dark-img { border-color: #333; background: #111; }
</style>
</head>
<body>
  <h1>Home Screen Icons Preview</h1>
  <div class="grid">
`;

files.forEach((light) => {
	const dark = light.replace(".webp", ".dark.webp");
	const hasDark = fs.existsSync(path.join(publicDir, dark));

	html += `
    <div class="card">
      <h3>${light.replace(".webp", "")}</h3>
      <div class="images">
        <div class="img-box">
          <p>Light</p>
          <img src="public/${light}" alt="Light" />
        </div>
        ${
					hasDark
						? `
        <div class="img-box">
          <p>Dark</p>
          <img class="dark-img" src="public/${dark}" alt="Dark" />
        </div>
        `
						: ""
				}
      </div>
    </div>
  `;
});

html += `
  </div>
</body>
</html>
`;

fs.writeFileSync("preview_icons.html", html);
console.log("preview_icons.html generated!");
