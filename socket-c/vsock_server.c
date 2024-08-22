#include <sys/socket.h>
#include <linux/vm_sockets.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#define BUFSIZE 1024

void error(char *msg)
{
	perror(msg);
	exit(1);
}

int main(int argc, char **argv)
{
	// ./vsock_server {CID} {PORT}
	if (argc != 3) {
		printf("Usage: %s {CID} {PORT}\n", argv[0]);
		return 1;
	}
	unsigned int cid = atoi(argv[1]);
	unsigned int port = atoi(argv[2]);

	printf("CID: %u, PORT: %u\n", cid, port);

	int s = socket(AF_VSOCK, SOCK_STREAM, 0);

	struct sockaddr_vm addr;
	memset(&addr, 0, sizeof(struct sockaddr_vm));
	addr.svm_family = AF_VSOCK;
	addr.svm_port = port;
	addr.svm_cid = cid;

	if (bind(s, (struct sockaddr *)&addr, sizeof(struct sockaddr_vm)) < 0)
		error("Error on binding");

	if (listen(s, 0) < 0)
		error("Error on listening");

	struct sockaddr_vm peer_addr;
	socklen_t peer_addr_size = sizeof(struct sockaddr_vm);
	int peer_fd = accept(s, (struct sockaddr *)&peer_addr, &peer_addr_size);

	char buf[BUFSIZE];
	int n;

	bzero(buf, BUFSIZE);
	if ((n = read(peer_fd, buf, BUFSIZE)) < 0)
		error("Error on reading");
	printf("Received %d bytes: %s\n", n, buf);

	return 0;
}