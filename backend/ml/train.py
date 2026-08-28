import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.utils import to_categorical
from sklearn.metrics import classification_report, confusion_matrix
import json
from pathlib import Path

DATA_DIR = Path("processed_data")
MODEL_OUT = Path("model")
MODEL_OUT.mkdir(exist_ok=True)

X = np.load(DATA_DIR / "X.npy")
y = np.load(DATA_DIR / "y.npy")

print(f"Loaded X={X.shape}, y={y.shape}")

le = LabelEncoder()
y_encoded = le.fit_transform(y)
num_classes = len(le.classes_)
print(f"Classes ({num_classes}): {list(le.classes_)}")

y_categorical = to_categorical(y_encoded, num_classes=num_classes)

X_train, X_temp, y_train, y_temp = train_test_split(
    X, y_categorical, test_size=0.3, random_state=42, stratify=y_encoded
)
X_val, X_test, y_val, y_test = train_test_split(
    X_temp, y_temp, test_size=0.5, random_state=42
)

print(f"Train: {X_train.shape[0]}, Val: {X_val.shape[0]}, Test: {X_test.shape[0]}")

model = Sequential([
    LSTM(64, return_sequences=True, input_shape=(X.shape[1], X.shape[2])),
    Dropout(0.3),
    LSTM(32),
    Dropout(0.3),
    Dense(32, activation="relu"),
    Dense(num_classes, activation="softmax"),
])

model.compile(optimizer="adam", loss="categorical_crossentropy", metrics=["accuracy"])
model.summary()

history = model.fit(
    X_train, y_train,
    validation_data=(X_val, y_val),
    epochs=50,
    batch_size=16,
    verbose=1,
)

test_loss, test_acc = model.evaluate(X_test, y_test, verbose=0)
print(f"\nTest accuracy: {test_acc:.3f}")
print(f"Test loss: {test_loss:.3f}")

y_pred = model.predict(X_test)
y_pred_labels = np.argmax(y_pred, axis=1)
y_test_labels = np.argmax(y_test, axis=1)

print("\nClassification Report:")
all_label_indices = list(range(num_classes))
print(classification_report(
    y_test_labels, y_pred_labels,
    labels=all_label_indices,
    target_names=le.classes_,
    zero_division=0,
))
print("\nConfusion Matrix:")
print(confusion_matrix(y_test_labels, y_pred_labels))

model.save(MODEL_OUT / "sign_model.keras")

with open(MODEL_OUT / "labels.json", "w") as f:
    json.dump(list(le.classes_), f)

print(f"\nModel saved to {MODEL_OUT}/sign_model.keras")
print(f"Labels saved to {MODEL_OUT}/labels.json")