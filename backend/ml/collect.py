"""Record webcam samples for a sign into raw_data/<label>/ so they are included in training.

Usage (close the browser detect page first so the webcam is free):
    python collect.py thirsty

SPACE starts/stops recording (a frame is saved every ~0.15s while recording), q quits.
Vary your distance, angle, hand height and background between takes.
Then re-run:  python preprocess.py  &&  python train.py
"""
import sys
import time
from pathlib import Path

import cv2

SAVE_INTERVAL_S = 0.15

if len(sys.argv) != 2:
    sys.exit("usage: python collect.py <label>")

label = sys.argv[1]
out_dir = Path("raw_data") / label
out_dir.mkdir(parents=True, exist_ok=True)
count = len(list(out_dir.glob("webcam_*.jpg")))

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    sys.exit("Could not open webcam (is the detect page still open?)")

recording = False
last_save = 0.0
print(f"Recording '{label}'. SPACE = start/stop, q = quit.")

while True:
    ok, frame = cap.read()
    if not ok:
        break

    now = time.time()
    if recording and now - last_save >= SAVE_INTERVAL_S:
        cv2.imwrite(str(out_dir / f"webcam_{count:05d}.jpg"), frame)  # unmirrored, like the detect page
        count += 1
        last_save = now

    preview = cv2.flip(frame, 1)
    status = f"{'REC' if recording else 'paused'}  {label}: {count} webcam images"
    cv2.putText(preview, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.9,
                (0, 0, 255) if recording else (255, 255, 255), 2)
    cv2.imshow("collect", preview)

    key = cv2.waitKey(1) & 0xFF
    if key == ord(" "):
        recording = not recording
    elif key == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
print(f"Done. {count} webcam images in {out_dir}")
