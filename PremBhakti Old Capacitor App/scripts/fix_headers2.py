import os
import re

components_dir = r"C:\Users\damod\OneDrive\Desktop\aaaacursor\components"

def process_dir(directory):
    count = 0
    for root, _, files in os.walk(directory):
        if 'admin-panel' in root:
            continue
            
        for file in files:
            if file.endswith('.tsx'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Replace the hardcoded ry-maroon with the dynamic saffron-500
                new_content = re.sub(
                    r'from-ry-maroon to-\[#FF9933\]',
                    'from-saffron-500 to-orange-500',
                    content
                )
                
                if new_content != content:
                    print(f"Updated: {file}")
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    count += 1
    print(f"Total updated: {count}")

process_dir(components_dir)
