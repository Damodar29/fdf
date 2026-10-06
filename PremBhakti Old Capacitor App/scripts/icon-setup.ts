// ──────────────────────────────────────────────────────────────────────
// Icon Setup Server — visual crop tool for Android media notification
// Usage: npm run setup-icon
// Opens a browser-based crop tool where you can visually adjust the
// crop area for the Android lock screen media notification.
// Click "Save" to persist coordinates to scripts/icon-config.json.
// Then run "npm run generate-icons" to apply.
// ──────────────────────────────────────────────────────────────────────

import { exec } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const CONFIG_PATH = path.resolve("./scripts/icon-config.json");
const PORT = 3456;

// Read current config
function readConfig() {
	if (fs.existsSync(CONFIG_PATH)) {
		return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
	}
	return { inputPath: "", crop: { left: 0, top: 0, width: 512, height: 280 } };
}

// The self-contained HTML crop tool
function getCropToolHTML(config: any) {
	const crop = config.crop;
	return `<!DOCTYPE html>
<html>
<head>
  <title>Icon Crop Setup</title>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f172a; color: #e2e8f0; font-family: 'Segoe UI', sans-serif; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { text-align: center; color: #f8fafc; margin-bottom: 5px; font-size: 1.5rem; }
    .subtitle { text-align: center; color: #94a3b8; margin-bottom: 20px; font-size: 0.85rem; }
    
    .layout { display: flex; flex-direction: column; gap: 20px; align-items: center; }
    
    .preview-container { 
      width: 100%; max-width: 420px; 
      background: #1e293b; padding: 15px; border-radius: 20px; 
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .preview-title { font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
    .android-player {
      width: 100%; height: 140px;
      border-radius: 28px; overflow: hidden; position: relative; background: #333;
    }
    .android-player .preview-image { width: 100%; height: 100%; object-fit: cover; object-position: center; opacity: 0.8; }
    .player-ui { position: absolute; inset: 0; padding: 15px 20px; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; }
    .player-title { font-size: 14px; font-weight: bold; color: white; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
    .player-subtitle { font-size: 11px; color: #ddd; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
    .player-controls { display: flex; justify-content: center; gap: 18px; align-items: center; }
    .ctrl { width: 28px; height: 28px; background: rgba(255,255,255,0.9); border-radius: 50%; }
    .ctrl-sm { width: 18px; height: 18px; background: rgba(255,255,255,0.9); border-radius: 50%; }
    
    .cropper-wrapper { width: 100%; max-width: 512px; background: #000; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border-radius: 8px; overflow: hidden; }
    img { max-width: 100%; display: block; }
    
    .input-section { width: 100%; max-width: 512px; }
    .input-section label { display: block; color: #94a3b8; font-size: 0.8rem; margin-bottom: 4px; }
    .input-section input { width: 100%; padding: 10px 14px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 0.9rem; outline: none; }
    .input-section input:focus { border-color: #3b82f6; }
    
    .coords { margin-top: 10px; padding: 12px; background: #1e293b; border-radius: 8px; font-family: monospace; font-size: 14px; border: 1px solid #334155; text-align: center; color: #38bdf8; }
    
    .btn-row { display: flex; gap: 10px; margin-top: 15px; width: 100%; max-width: 512px; }
    .btn { flex: 1; padding: 14px; border: none; border-radius: 10px; font-size: 1rem; font-weight: bold; cursor: pointer; transition: all 0.2s; }
    .btn-save { background: #22c55e; color: white; }
    .btn-save:hover { background: #16a34a; transform: translateY(-1px); }
    .btn-save:active { transform: translateY(0); }
    .btn-cancel { background: #334155; color: #94a3b8; }
    .btn-cancel:hover { background: #475569; }
    
    .status { margin-top: 10px; padding: 10px; border-radius: 8px; text-align: center; font-weight: bold; display: none; }
    .status.success { display: block; background: #166534; color: #86efac; }
    .status.error { display: block; background: #7f1d1d; color: #fca5a5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎨 Icon Crop Setup</h1>
    <p class="subtitle">Adjust the crop box to match what should appear on the Android lock screen media player</p>
    
    <div class="layout">
      <!-- Input Path -->
      <div class="input-section">
        <label>Source Image Path:</label>
        <input type="text" id="inputPath" value="${config.inputPath.replace(/\\/g, "\\\\")}" placeholder="C:\\\\path\\\\to\\\\icon.webp" />
      </div>

      <!-- Live Android Preview -->
      <div class="preview-container">
        <div class="preview-title">📱 Live Android Preview</div>
        <div class="android-player">
          <img id="live-preview" class="preview-image" src="" alt="">
          <div class="player-ui">
            <div>
              <div class="player-title">मंगलाचरण</div>
              <div class="player-subtitle">श्रील गुरुदेव "भक्तिशास्त्री" जी महाराज</div>
            </div>
            <div class="player-controls">
              <div class="ctrl-sm"></div>
              <div class="ctrl"></div>
              <div class="ctrl-sm"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cropper -->
      <div class="cropper-wrapper">
        <img id="image" src="/icon" alt="Icon">
      </div>
      
      <div class="coords" id="coords">Loading...</div>
      
      <div class="btn-row">
        <button class="btn btn-save" id="saveBtn">💾 Save & Close</button>
        <button class="btn btn-cancel" onclick="window.close()">Cancel</button>
      </div>
      
      <div class="status" id="status"></div>
    </div>
  </div>

  <script>
    var currentCrop = { left: ${crop.left}, top: ${crop.top}, width: ${crop.width}, height: ${crop.height} };
    
    window.addEventListener('DOMContentLoaded', function () {
      var image = document.getElementById('image');
      var livePreview = document.getElementById('live-preview');
      var coordsEl = document.getElementById('coords');
      var cropper;
      
      function initCropper() {
        if (cropper) return;
        cropper = new Cropper(image, {
          viewMode: 1,
          aspectRatio: 2.5, // Lock to Android media card ratio!
          zoomable: false,
          ready: function () {
            var natW = image.naturalWidth;
            var natH = image.naturalHeight;
            cropper.setData({
              x: currentCrop.left * natW / 512,
              y: currentCrop.top * natH / 512,
              width: currentCrop.width * natW / 512,
              height: currentCrop.height * natH / 512
            });
          },
          crop: function (event) {
            var canvas = cropper.getCroppedCanvas();
            if (canvas) livePreview.src = canvas.toDataURL();
            
            var natW = image.naturalWidth;
            var natH = image.naturalHeight;
            var sx = 512 / natW, sy = 512 / natH;
            
            currentCrop = {
              left: Math.round(event.detail.x * sx),
              top: Math.round(event.detail.y * sy),
              width: Math.round(event.detail.width * sx),
              height: Math.round(event.detail.height * sy)
            };
            coordsEl.innerText = JSON.stringify(currentCrop);
          }
        });
      }
      
      image.onload = initCropper;
      if (image.complete) initCropper();
    });
    
    document.getElementById('saveBtn').addEventListener('click', function() {
      var statusEl = document.getElementById('status');
      var inputPathVal = document.getElementById('inputPath').value.trim();
      
      var body = JSON.stringify({
        inputPath: inputPathVal,
        crop: currentCrop
      });
      
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.ok) {
          statusEl.className = 'status success';
          statusEl.textContent = '✅ Config saved! Now run: npm run generate-icons';
          statusEl.style.display = 'block';
        } else {
          statusEl.className = 'status error';
          statusEl.textContent = '❌ Error: ' + data.error;
          statusEl.style.display = 'block';
        }
      })
      .catch(function(err) {
        statusEl.className = 'status error';
        statusEl.textContent = '❌ Network error: ' + err.message;
        statusEl.style.display = 'block';
      });
    });
  </script>
</body>
</html>`;
}

// ── Server ──
const server = http.createServer((req, res) => {
	const config = readConfig();

	// Serve icon image
	if (req.url === "/icon") {
		const iconPath = config.inputPath;
		if (fs.existsSync(iconPath)) {
			const ext = path.extname(iconPath).toLowerCase();
			const mime = ext === ".webp" ? "image/webp" : "image/png";
			res.writeHead(200, { "Content-Type": mime });
			fs.createReadStream(iconPath).pipe(res);
		} else {
			// Fallback to public/icon.webp
			const fallback = path.resolve("./public/icon.webp");
			if (fs.existsSync(fallback)) {
				res.writeHead(200, { "Content-Type": "image/png" });
				fs.createReadStream(fallback).pipe(res);
			} else {
				res.writeHead(404);
				res.end("Icon not found");
			}
		}
		return;
	}

	// Save config
	if (req.url === "/api/save" && req.method === "POST") {
		let body = "";
		req.on("data", (chunk: Buffer) => {
			body += chunk.toString();
		});
		req.on("end", () => {
			try {
				const newConfig = JSON.parse(body);
				fs.writeFileSync(
					CONFIG_PATH,
					`${JSON.stringify(newConfig, null, 2)}\n`,
					"utf8",
				);
				console.log("✅ Config saved:", JSON.stringify(newConfig.crop));
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ ok: true }));
			} catch (e: any) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ ok: false, error: e.message }));
			}
		});
		return;
	}

	// Serve crop tool HTML
	res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
	res.end(getCropToolHTML(config));
});

server.listen(PORT, () => {
	const url = `http://localhost:${PORT}`;
	console.log(`\n🎨 Icon Crop Tool running at: ${url}\n`);
	console.log("📋 Steps:");
	console.log("   1. Adjust the crop box in the browser");
	console.log("   2. Check the Live Android Preview");
	console.log('   3. Click "Save & Close"');
	console.log("   4. Run: npm run generate-icons\n");

	// Auto-open browser
	const cmd =
		process.platform === "win32"
			? "start"
			: process.platform === "darwin"
				? "open"
				: "xdg-open";
	exec(`${cmd} ${url}`);
});
