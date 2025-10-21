FROM redis
USER redis
COPY --chown=redis:redis ./evio_Redis_Sentinel_Config/sentinel.conf /etc/redis/sentinel.conf
RUN chmod 640 /etc/redis/sentinel.conf
RUN mkdir -p /tmp/redis
