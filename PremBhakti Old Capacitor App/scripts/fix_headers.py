import os
import re

components_dir = r"C:\Users\damod\OneDrive\Desktop\aaaacursor\components"

# The target gradient classes
target_gradient = "bg-gradient-to-r from-ry-maroon to-[#FF9933] text-ry-cream"

def fix_header(content, filename):
    # If this is the main Header.tsx, we replace its specific classes
    if filename == 'Header.tsx':
        # Replace the header background
        new_content = re.sub(
            r'bg-ry-cream dark:bg-\[#3A1010\]',
            'bg-gradient-to-r from-ry-maroon to-[#FF9933]',
            content
        )
        # Update text colors in Header.tsx so they are visible on the new dark background
        new_content = re.sub(
            r'text-ry-maroon dark:text-ry-gold',
            'text-ry-cream dark:text-ry-gold',
            new_content
        )
        new_content = re.sub(
            r'bg-ry-maroon dark:bg-ry-gold',
            'bg-ry-cream dark:bg-ry-gold',
            new_content
        )
        return new_content

    # Skip screens that might intentionally have different headers
    if filename in ['YouTubeScreen.tsx', 'FacebookScreen.tsx', 'InstagramScreen.tsx']:
        return content

    # Patterns for all the flex-none sticky headers in other screens
    patterns = [
        r'flex-none bg-ry-maroon dark:bg-black text-ry-gold',
        r'flex-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700',
        r'flex-none bg-ry-maroon/90 dark:bg-\[#3A1010\]/90 text-ry-gold backdrop-blur-md',
        r'flex-none bg-saffron-500 text-white',
        r'flex-none bg-gradient-to-r from-saffron-500 to-orange-600 text-white',
        r'flex-none bg-gradient-to-r from-blue-500 to-cyan-600 text-white',
        r'flex-none bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-sm border-b border-saffron-100 dark:border-slate-800',
        r'flex-none bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700',
        r'flex-none bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-sm border-b dark:border-slate-800',
        r'flex-none bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700',
        r'flex-none bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800'
    ]
    
    new_content = content
    for p in patterns:
        new_content = re.sub(
            p, 
            'flex-none bg-gradient-to-r from-ry-maroon to-[#FF9933] text-ry-cream shadow-md border-b-2 border-ry-gold/40', 
            new_content
        )
        
    return new_content

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
                
                new_content = fix_header(content, file)
                
                if new_content != content:
                    print(f"Updated: {file}")
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    count += 1
    print(f"Total updated: {count}")

process_dir(components_dir)
