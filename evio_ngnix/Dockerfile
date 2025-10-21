FROM openresty/openresty:alpine-fat

RUN /usr/local/openresty/luajit/bin/luarocks install lua-resty-upload

RUN echo "user root root; " >> //usr/local/openresty/nginx/conf/nginx.conf

CMD ["nginx", "-g", "daemon off;"]
