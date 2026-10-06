import fs from "node:fs";

const imagePath = "./android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png";
const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString("base64");
const tsContent = `export const defaultIconBase64 = 'data:image/png;base64,${base64Image}';\n`;

fs.writeFileSync("./src/iconBase64.ts", tsContent);
console.log("Successfully generated src/iconBase64.ts");
