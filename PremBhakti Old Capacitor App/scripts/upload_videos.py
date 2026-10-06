import os
import internetarchive
from dotenv import load_dotenv

# Load env variables
load_dotenv()

access_key = os.getenv('IA_ACCESS_KEY')
secret_key = os.getenv('IA_SECRET_KEY')

if not access_key or not secret_key:
    print("Error: IA_ACCESS_KEY or IA_SECRET_KEY not found in .env")
    exit(1)

identifier = "gaur_poornima_2024_videos"

# Read the file
video_list_path = "gaur_purnima_videos.txt"
with open(video_list_path, 'r') as f:
    video_names = [line.strip() for line in f.readlines() if line.strip()]

base_dir = r"C:\Bablu Mama Pendrive\Holi 2k24"
files_to_upload = []

import urllib.parse

for name in video_names:
    decoded_name = urllib.parse.unquote(name)
    full_path = os.path.join(base_dir, decoded_name)
    if os.path.exists(full_path):
        files_to_upload.append(full_path)
    else:
        print(f"Warning: File not found - {full_path}")

if not files_to_upload:
    print("No valid files to upload.")
    exit(1)

print(f"Uploading {len(files_to_upload)} files to Internet Archive item '{identifier}'...")

md = {
    'title': 'Gaur poornima 2024 videos', 
    'mediatype': 'movies'
}

try:
    # Use verbose=True to get progress
    r = internetarchive.upload(
        identifier, 
        files=files_to_upload, 
        metadata=md, 
        access_key=access_key, 
        secret_key=secret_key,
        verbose=True,
        retries=3
    )
    
    status = r[0].status_code if isinstance(r, list) and r else "Success"
    print(f"Upload process finished. Status: {status}")
    print(f"You can view the item at: https://archive.org/details/{identifier}")
except Exception as e:
    print("Error during upload:", e)
