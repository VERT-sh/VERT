#!/bin/sh

if [ -f /proc/net/if_inet6 ] && ip -6 addr show lo >/dev/null 2>&1; then
    sed -i 's/# IPV6_PLACEHOLDER/listen [::]:80;/' /etc/nginx/conf.d/default.conf
else
    sed -i 's/# IPV6_PLACEHOLDER//' /etc/nginx/conf.d/default.conf
fi

exec /docker-entrypoint.sh "$@"
