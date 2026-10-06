import os
import sys
from internetarchive import upload

# ==========================================
# CONFIGURATION & SECRETS
# ==========================================
IA_ACCESS_KEY = "mdRdyBNrbKBXJXEw"
IA_SECRET_KEY = "gl9YfWULC9iwYGVc"
ITEM_NAME = "chaitanya-prembhakti-App-Inauguration"

# File to upload
FILE_TO_UPLOAD = "App Inauguration.mp4"

def main():
    print("=================================================")
    print(" Uploading Video to Internet Archive")
    print("=================================================\n")
    
    # Resolve the correct path depending on where the script is run from
    if not os.path.exists(FILE_TO_UPLOAD):
        # Fallback if running directly from the 'scripts/' directory
        fallback_path = os.path.join("..", FILE_TO_UPLOAD)
        if os.path.exists(fallback_path):
            file_path = fallback_path
        else:
            print(f"❌ ERROR: File '{FILE_TO_UPLOAD}' not found!")
            sys.exit(1)
    else:
        file_path = FILE_TO_UPLOAD
        
    print(f"⬆️ Uploading {file_path} to Archive.org item '{ITEM_NAME}'...")
    
    try:
        responses = upload(
            ITEM_NAME,
            files=[file_path],
            access_key=IA_ACCESS_KEY,
            secret_key=IA_SECRET_KEY,
            verbose=True,
            verify=True,
            checksum=True,
            retries=50,
            retries_sleep=15,
        )
        
        # Responses is a list of requests.Response objects
        failures = [r for r in responses if getattr(r, "status_code", 0) >= 400]
        if failures:
            print(f"❌ Upload failures for {file_path}:", [getattr(r, "status_code", None) for r in failures])
        else:
            print(f"✅ Successfully uploaded {file_path}!")
            
    except Exception as e:
        print(f"❌ Exception during upload: {e}")

if __name__ == "__main__":
    main()
