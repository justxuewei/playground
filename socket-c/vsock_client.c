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
	// ./vsock_server {BOUND_CID} {BOUND_PORT} {CID} {PORT}
	if (argc != 5) {
		printf("Usage: %s {BOUND_CID} {BOUND_PORT} {CID} {PORT}\n",
		       argv[0]);
		return 1;
	}
	unsigned int bound_cid = atoi(argv[1]);
	unsigned int bound_port = atoi(argv[2]);
	unsigned int cid = atoi(argv[3]);
	unsigned int port = atoi(argv[4]);

	printf("BOUND_CID: %u, BOUND_PORT: %u, "
	       "CID: %u, PORT: %u\n",
	       bound_cid, bound_port, cid, port);

	int s = socket(AF_VSOCK, SOCK_STREAM, 0);

	if (bound_cid != -1U) {
		printf("Bind to a vsock device whose CID == %u\n", bound_cid);
		struct sockaddr_vm addr;
		memset(&addr, 0, sizeof(struct sockaddr_vm));
		addr.svm_family = AF_VSOCK;
		addr.svm_port = bound_port;
		addr.svm_cid = bound_cid;

		if (bind(s, (struct sockaddr *)&addr,
			 sizeof(struct sockaddr_vm)) < 0)
			error("Error on binding");
	} else {
		printf("Do not bind any vsock devices\n");
	}

	struct sockaddr_vm peer_addr;
	memset(&peer_addr, 0, sizeof(struct sockaddr_vm));
	socklen_t peer_addr_size = sizeof(struct sockaddr_vm);
	peer_addr.svm_family = AF_VSOCK;
	peer_addr.svm_port = port;
	peer_addr.svm_cid = cid;
	if (connect(s, (struct sockaddr *)&peer_addr, peer_addr_size) < 0)
		error("Error on connecting");

	char buf[BUFSIZE];
	int n;

	bzero(buf, BUFSIZE);
	strncpy(buf, "hello from peer", sizeof(buf) - 1);
	n = write(s, buf, strlen(buf));
	if (n <= 0)
		error("Error on writing");
	printf("Sent %d bytes: %s\n", n, buf);

	bzero(buf, BUFSIZE);
	n = read(s, buf, BUFSIZE);
	if (n <= 0)
		error("Error on reading");
	printf("Received %d bytes: %s\n", n, buf);

	close(s);

	return 0;
}