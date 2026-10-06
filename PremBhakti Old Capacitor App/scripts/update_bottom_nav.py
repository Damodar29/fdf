import os

filepath = r"C:\Users\damod\OneDrive\Desktop\aaaacursor\components\BottomNav.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('iconUrl={"/rathyatratheme/Books_nav.webp?v=2"}', 'icon={<BookOpen />}\n            iconUrl={undefined}')
content = content.replace('iconUrl={"/rathyatratheme/Audio.webp?v=2"}', 'icon={<Headphones />}\n            iconUrl={undefined}')
content = content.replace('iconUrl={"/rathyatratheme/Home.webp?v=2"}', 'icon={<Home />}\n            iconUrl={undefined}')
content = content.replace('iconUrl={"/rathyatratheme/Bhajan_nav.webp?v=2"}', 'icon={<Music />}\n            iconUrl={undefined}')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
