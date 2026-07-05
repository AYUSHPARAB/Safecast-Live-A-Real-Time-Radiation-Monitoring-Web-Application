FROM flink:1.17.1-scala_2.12-java11

RUN apt-get update && apt-get install -y python3 python3-pip && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    pip3 install apache-flink==1.17.1 kafka-python confluent-kafka==2.3.0


RUN wget -P /opt/flink/lib/ \
    https://repo.maven.apache.org/maven2/org/apache/flink/flink-sql-connector-kafka/1.17.1/flink-sql-connector-kafka-1.17.1.jar

COPY flink_job.py /opt/flink/usrlib/flink_job.py
COPY config.py    /opt/flink/usrlib/config.py