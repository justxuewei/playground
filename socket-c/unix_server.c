#include <sys/socket.h>
#include <sys/un.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#define BUFSIZE 1024

int main(int argc, char **argv)
{
	int use_abs_path, server_fd, client_fd, n;
	char path[108];
	struct sockaddr_un server_addr, client_addr;
	char buf[BUFSIZE];
	socklen_t client_addr_len = sizeof(client_addr);

	if (argc == 2) {
		use_abs_path = 0;
		strcpy(path, argv[1]);
	} else if (argc == 3) {
		if (strcmp(argv[1], "-a"))
			goto out;
		use_abs_path = 1;
		strcpy(path, argv[2]);
	} else {
		goto out;
	}

	if ((server_fd = socket(AF_UNIX, SOCK_STREAM, 0)) < 0) {
		perror("socket failed");
		return server_fd;
	}

	memset(&server_addr, 0, sizeof(struct sockaddr_un));
	server_addr.sun_family = AF_UNIX;
	if (use_abs_path) {
		server_addr.sun_path[0] = 0;
		strncpy(server_addr.sun_path + 1, path,
			sizeof(server_addr.sun_path) - 2);
		server_addr.sun_path[strlen(path) + 2] = 0;
	} else {
		strncpy(server_addr.sun_path, path,
			sizeof(server_addr.sun_path) - 1);
	}

	if (!use_abs_path)
		unlink(path); // 删除已存在的 socket 文件

	if (bind(server_fd, (struct sockaddr *)&server_addr,
		 sizeof(struct sockaddr_un)) < 0) {
		perror("bind failed");
		close(server_fd);
		return -1;
	}

	if (listen(server_fd, 5) < 0) {
		perror("listen failed");
		close(server_fd);
		return -1;
	}

	if (use_abs_path)
		printf("Server is listening on @%s\n", path);
	else
		printf("Server is listening on %s\n", path);

	if ((client_fd = accept(server_fd, (struct sockaddr *)&client_addr,
				&client_addr_len)) < 0) {
		perror("accept failed");
		close(server_fd);
		return -1;
	}

	memset(buf, 0, BUFSIZE);
	n = recv(client_fd, buf, BUFSIZE, 0);
	if (n < 0) {
		perror("recv failed");
		close(client_fd);
		close(server_fd);
		return -1;
	}
	printf("Received %d bytes from client:\n%s\n", n, buf);

	strcpy(buf, "hello from server!");
	n = send(client_fd, buf, strlen(buf), 0);
	if (n < 0) {
		perror("send failed");
		close(client_fd);
		close(server_fd);
		return n;
	}
	printf("Sent %d bytes to client:\n%s\n", n, buf);

	close(client_fd);
	close(server_fd);
	if (!use_abs_path)
		unlink(path); // 删除 socket 文件

	return 0;

out:
	printf("Usage: %s [-a] {socket_path}\n", argv[0]);
	return -1;
}
