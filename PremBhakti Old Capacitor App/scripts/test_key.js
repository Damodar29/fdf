const title = "षष्ठम दिवस की झलकियाँ";
const folder = "श्री श्रीमद् भागवत कथा सप्ताह भक्ति महायज्ञ,दमोह की झलकियां";
const safeFileName = `${title.replace(/\s+/g, "-").replace(/[/\\?%*:|"<>]/g, "-")}.mp4`;
const safeFolderName = folder.replace(/[/\\?%*:|"<>]/g, "-").trim();
console.log(`${safeFolderName}/${safeFileName}`);
