#include <sys/socket.h>
#include <sys/un.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#define BUFSIZE 1024

socklen_t init_sockaddr_un(struct sockaddr_un *sun, char *path,
			   int use_abs_path)
{
	socklen_t len = sizeof(*sun);
	size_t copied_len = 0;

	memset(sun, 0, sizeof(*sun));

	sun->sun_family = AF_UNIX;

	if (use_abs_path) {
		copied_len = strnlen(path, sizeof(sun->sun_path) - 2);
		strncpy(sun->sun_path + 1, path, copied_len);
		len -= (108 - copied_len - 1);
	} else {
		copied_len = strnlen(path, sizeof(sun->sun_path) - 1);
		strncpy(sun->sun_path, path, copied_len);
		len -= (108 - copied_len);
	}

	return len;
}

int main(int argc, char **argv)
{
	int use_abs_path, server_fd, client_fd, n, err = 0;
	char *path = NULL;
	struct sockaddr_un server_addr, client_addr;
	char buf[BUFSIZE];
	socklen_t server_addr_len, client_addr_len = sizeof(client_addr);

	if (argc == 2) {
		path = argv[1];
		use_abs_path = 0;
	} else if (argc == 3) {
		if (strcmp(argv[1], "-a")) {
			err = -1;
			goto printusage;
		}
		use_abs_path = 1;
		path = argv[2];
	} else {
		err = -1;
		goto printusage;
	}

	if ((server_fd = socket(AF_UNIX, SOCK_STREAM, 0)) < 0) {
		perror("socket failed");
		return server_fd;
	}

	server_addr_len = init_sockaddr_un(&server_addr, path, use_abs_path);

	if (!use_abs_path)
		unlink(path); // 删除已存在的 socket 文件

	err = bind(server_fd, (struct sockaddr *)&server_addr, server_addr_len);
	if (err < 0) {
		perror("bind failed");
		goto closesvr;
	}

	err = listen(server_fd, 5);
	if (err < 0) {
		perror("listen failed");
		goto closesvr;
	}

	if (use_abs_path)
		printf("Server is listening on @%s\n", path);
	else
		printf("Server is listening on %s\n", path);

	if ((client_fd = accept(server_fd, (struct sockaddr *)&client_addr,
				&client_addr_len)) < 0) {
		perror("accept failed");
		err = client_fd;
		goto closeall;
	}

	memset(buf, 0, BUFSIZE);
	n = recv(client_fd, buf, BUFSIZE, 0);
	if (n < 0) {
		perror("recv failed");
		err = n;
		goto closeall;
	}
	printf("Received %d bytes from client:\n%s\n", n, buf);

	strcpy(buf, "hello from server!");
	n = send(client_fd, buf, strlen(buf), 0);
	if (n < 0) {
		perror("send failed");
		err = n;
		goto closeall;
	}
	printf("Sent %d bytes to client:\n%s\n", n, buf);

closeall:
	close(client_fd);
closesvr:
	close(server_fd);
	if (!use_abs_path)
		unlink(path);
	return err;

printusage:
	printf("Usage: %s [-a] {socket_path}\n", argv[0]);
	return err;
}
