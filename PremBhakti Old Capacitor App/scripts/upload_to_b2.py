import os
import requests
from b2sdk.v2 import InMemoryAccountInfo, B2Api

def download_file(url, local_filename):
    print(f"Downloading {url} to {local_filename}...")
    with requests.get(url, stream=True) as r:
        r.raise_for_status()
        with open(local_filename, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192): 
                f.write(chunk)
    print("Download complete.")
    return local_filename

def upload_to_b2(file_path, b2_key_id, b2_application_key, bucket_name):
    print(f"Uploading {file_path} to Backblaze B2 bucket '{bucket_name}'...")
    info = InMemoryAccountInfo()
    b2_api = B2Api(info)
    
    # Authorize with Backblaze B2
    b2_api.authorize_account("production", b2_key_id, b2_application_key)
    
    # Get the bucket
    bucket = b2_api.get_bucket_by_name(bucket_name)
    
    # Upload the file to a specific folder
    bucket.upload_local_file(
        local_file=file_path,
        file_name=f"Uploaded from app/{os.path.basename(file_path)}",
    )
    print("Upload complete.")

if __name__ == "__main__":
    video_url = "https://github.com/chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1/releases/download/chaitanya-prembhakti-App-Inauguration/App.Inauguration.mp4"
    local_file = "App.Inauguration.mp4"
    
    b2_key_id = "005281b623ef32b0000000001"
    b2_app_key = "K005KG0gTQVPFRf9csLYfks+e/X26XI"
    b2_bucket_name = "cpbs-videos"

    try:
        download_file(video_url, local_file)
        upload_to_b2(local_file, b2_key_id, b2_app_key, b2_bucket_name)
        
        # Optional: Clean up the downloaded file after upload
        # os.remove(local_file)
    except Exception as e:
        print(f"An error occurred: {e}")
