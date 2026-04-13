import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable
import json
import logging
import threading
from socketio_instance import socketio # Import the existing SocketIO instance from app.py


# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

KAFKA_BROKER = "localhost:9092"
KAFKA_TOPIC = "anomaly-scores"

def consume_kafka_messages():
    """Kafka Consumer that listens for messages and sends them to the frontend."""
    try:
        consumer = KafkaConsumer(
            KAFKA_TOPIC,
            bootstrap_servers=KAFKA_BROKER,
            auto_offset_reset="latest",
            enable_auto_commit=True,
            group_id="realtime-dashboard",
            value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        )
    except (NoBrokersAvailable, OSError) as e:
        logging.warning("Kafka Consumer failed to connect: %s", e)
        return

    logging.info("Kafka Consumer is listening for messages...")

    try:
        for message in consumer:
            data = message.value
            logging.info(f"Received from Kafka: {data}")

            socketio.emit("new_kafka_message", data)
    except Exception as e:
        logging.warning("Kafka Consumer stopped: %s", e)

# Run Kafka Consumer in a separate thread
def start_kafka_consumer():
    thread = threading.Thread(target=consume_kafka_messages, daemon=True)
    thread.start()
