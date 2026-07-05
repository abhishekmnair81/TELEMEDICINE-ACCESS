#!/usr/bin/env python3
# generate_icons.py
# Run this script to generate PWA icons for the medicine reminder app
# Usage: python generate_icons.py
# Output: icons/ folder with all required PNG files

import os
import struct
import zlib

def create_pill_png(size, filename, bg_color=(0, 179, 142), fg_color=(255, 255, 255)):
    """Create a simple pill icon PNG using raw bytes (no PIL needed)."""
    
    def create_png(width, height, pixels):
        """Build a PNG file from raw RGBA pixel data."""
        def png_chunk(chunk_type, data):
            chunk_len = len(data)
            chunk_data = chunk_type + data
            crc = zlib.crc32(chunk_data) & 0xffffffff
            return struct.pack('>I', chunk_len) + chunk_data + struct.pack('>I', crc)
        
        # PNG signature
        signature = b'\x89PNG\r\n\x1a\n'
        
        # IHDR chunk
        ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
        ihdr = png_chunk(b'IHDR', ihdr_data)
        
        # IDAT chunk (image data)
        raw_data = b''
        for row in pixels:
            raw_data += b'\x00'  # filter type none
            for r, g, b in row:
                raw_data += bytes([r, g, b])
        
        compressed = zlib.compress(raw_data, 9)
        idat = png_chunk(b'IDAT', compressed)
        
        # IEND chunk
        iend = png_chunk(b'IEND', b'')
        
        return signature + ihdr + idat + iend
    
    w = h = size
    half = w // 2
    
    # Create pixel grid
    pixels = []
    for y in range(h):
        row = []
        for x in range(w):
            # Normalize to [-1, 1]
            nx = (x - half) / half
            ny = (y - half) / half
            
            # Background: rounded square
            corner_r = 0.3  # corner radius
            ax = abs(nx) - (1 - corner_r)
            ay = abs(ny) - (1 - corner_r)
            
            if ax > 0 and ay > 0:
                dist = (ax**2 + ay**2) ** 0.5
                if dist > corner_r:
                    row.append((255, 255, 255))  # outside
                    continue
            elif abs(nx) > 1 or abs(ny) > 1:
                row.append((255, 255, 255))
                continue
            
            # Background color
            br, bg_c, bb = bg_color
            
            # Draw pill shape in center (horizontal capsule)
            pill_w = 0.55
            pill_h = 0.22
            pill_x = nx
            pill_y = ny
            
            # Capsule: rectangle + two semicircles
            in_rect = abs(pill_x) <= pill_w - pill_h and abs(pill_y) <= pill_h
            in_left = (pill_x + pill_w - pill_h)**2 + pill_y**2 <= pill_h**2 and pill_x < 0
            in_right = (pill_x - (pill_w - pill_h))**2 + pill_y**2 <= pill_h**2 and pill_x >= 0
            
            if in_rect or in_left or in_right:
                # White pill outline
                fr, fg_c, fb = fg_color
                
                # Color split: left half teal, right half white
                if pill_x < 0:
                    row.append((fr, fg_c, fb))
                else:
                    # Slightly darker version of bg
                    row.append((max(0, br - 30), max(0, bg_c - 30), max(0, bb - 30)))
            else:
                row.append((br, bg_c, bb))
        
        pixels.append(row)
    
    png_data = create_png(w, h, pixels)
    
    with open(filename, 'wb') as f:
        f.write(png_data)
    
    print(f'✅ Created: {filename} ({size}x{size})')


def create_badge_png(size, filename):
    """Create a simple badge/notification icon."""
    w = h = size
    half = w // 2
    
    def create_png(width, height, pixels):
        def png_chunk(chunk_type, data):
            chunk_len = len(data)
            chunk_data = chunk_type + data
            crc = zlib.crc32(chunk_data) & 0xffffffff
            return struct.pack('>I', chunk_len) + chunk_data + struct.pack('>I', crc)
        
        signature = b'\x89PNG\r\n\x1a\n'
        ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
        ihdr = png_chunk(b'IHDR', ihdr_data)
        
        raw_data = b''
        for row in pixels:
            raw_data += b'\x00'
            for r, g, b in row:
                raw_data += bytes([r, g, b])
        
        compressed = zlib.compress(raw_data, 9)
        idat = png_chunk(b'IDAT', compressed)
        iend = png_chunk(b'IEND', b'')
        return signature + ihdr + idat + iend
    
    pixels = []
    for y in range(h):
        row = []
        for x in range(w):
            nx = (x - half) / half
            ny = (y - half) / half
            dist = (nx**2 + ny**2) ** 0.5
            
            if dist <= 0.9:
                row.append((0, 179, 142))  # teal circle
            else:
                row.append((255, 255, 255))
        pixels.append(row)
    
    png_data = create_png(w, h, pixels)
    with open(filename, 'wb') as f:
        f.write(png_data)
    print(f'✅ Created: {filename} ({size}x{size})')


def main():
    # Create icons directory (inside public/)
    icons_dir = os.path.join('public', 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    
    # Also create sounds directory
    sounds_dir = os.path.join('public', 'sounds')
    os.makedirs(sounds_dir, exist_ok=True)
    
    print('🎨 Generating PWA icons...')
    print('=' * 50)
    
    # Pill icons (all sizes)
    pill_sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    for size in pill_sizes:
        filename = os.path.join(icons_dir, f'pill-{size}.png')
        create_pill_png(size, filename, bg_color=(0, 179, 142), fg_color=(255, 255, 255))
    
    # Badge icon
    create_badge_png(72, os.path.join(icons_dir, 'badge-72.png'))
    
    # Create a simple notification sound (beep WAV)
    create_notification_sound(os.path.join(sounds_dir, 'reminder.mp3'))
    
    print('\n' + '=' * 50)
    print('✅ All icons generated!')
    print(f'📁 Icons saved to: {icons_dir}/')
    print(f'🔊 Sound saved to: {sounds_dir}/')
    print('\nNext steps:')
    print('1. Copy public/icons/ to your React project public/icons/')
    print('2. Copy public/sounds/ to your React project public/sounds/')
    print('3. Copy manifest.json to your React project public/manifest.json')
    print('4. Copy sw.js to your React project public/sw.js')


def create_notification_sound(filename):
    """Create a simple WAV file as placeholder notification sound."""
    import struct, math
    
    # Generate a simple pleasant chime
    sample_rate = 44100
    duration = 0.5  # seconds
    frequency = 880  # Hz (A5 note)
    
    num_samples = int(sample_rate * duration)
    
    samples = []
    for i in range(num_samples):
        t = i / sample_rate
        # Envelope: fade in and out
        envelope = math.sin(math.pi * t / duration)
        sample = int(32767 * 0.5 * envelope * math.sin(2 * math.pi * frequency * t))
        samples.append(sample)
    
    # WAV header
    data_size = num_samples * 2  # 16-bit samples
    
    with open(filename.replace('.mp3', '.wav'), 'wb') as f:
        # RIFF header
        f.write(b'RIFF')
        f.write(struct.pack('<I', 36 + data_size))
        f.write(b'WAVE')
        
        # fmt chunk
        f.write(b'fmt ')
        f.write(struct.pack('<I', 16))   # chunk size
        f.write(struct.pack('<H', 1))    # PCM format
        f.write(struct.pack('<H', 1))    # mono
        f.write(struct.pack('<I', sample_rate))
        f.write(struct.pack('<I', sample_rate * 2))  # byte rate
        f.write(struct.pack('<H', 2))    # block align
        f.write(struct.pack('<H', 16))   # bits per sample
        
        # data chunk
        f.write(b'data')
        f.write(struct.pack('<I', data_size))
        for sample in samples:
            f.write(struct.pack('<h', sample))
    
    # Also save as mp3 name pointing to wav (browser accepts wav)
    wav_path = filename.replace('.mp3', '.wav')
    if os.path.exists(wav_path):
        # Copy wav to mp3 path (browsers handle wav fine)
        import shutil
        shutil.copy(wav_path, filename)
    
    print(f'✅ Created: {filename}')


if __name__ == '__main__':
    main()