#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/time.h>
#include <time.h>

long long get_time_in_microseconds()
{
	struct timeval tv;
	gettimeofday(&tv, NULL);
	return tv.tv_sec * 1000000LL + tv.tv_usec;
}

int main(int argc, char *argv[])
{
	if (argc != 5) {
		printf("Usage: %s <IP> <Port> <Data size (KB)> <Rounds>\n",
		       argv[0]);
		return 1;
	}

	char *ip = argv[1];
	int port = atoi(argv[2]);
	int data_size_kb = atoi(argv[3]);
	int rounds = atoi(argv[4]);

	int server_sock, err;
	struct sockaddr_in server_addr, client_addr;
	socklen_t client_addr_size;
	char *data;
	struct timeval tv;
	struct tm *tm_now;
	char formatted_time[24];

	// Create simulated data
	data = malloc(data_size_kb * 1024);
	if (data == NULL) {
		perror("error on creating simulated data");
		return 1;
	}
	memset(data, 'A', data_size_kb * 1024 - 1);
	data[data_size_kb * 1024 - 1] = '\0';

	// Create server socket
	server_sock = socket(AF_INET, SOCK_STREAM, 0);
	if (server_sock == -1) {
		perror("error on creating socket");
		err = -1;
		goto out_data;
	}

	int optval = 1;
	if (setsockopt(server_sock, SOL_SOCKET, SO_REUSEADDR, &optval,
		       sizeof(optval)) == -1) {
		perror("error on setting SO_REUSEADDR");
		err = -1;
		goto out_server;
	}

	memset(&server_addr, 0, sizeof(server_addr));
	server_addr.sin_family = AF_INET;
	server_addr.sin_addr.s_addr = inet_addr(ip);
	server_addr.sin_port = htons(port);

	if (bind(server_sock, (struct sockaddr *)&server_addr,
		 sizeof(server_addr)) == -1) {
		perror("error on binding");
		err = -1;
		goto out_server;
	}

	if (listen(server_sock, 5) == -1) {
		perror("error on listening");
		err = -1;
		goto out_server;
	}

	client_addr_size = sizeof(client_addr);
	int client_sock = accept(server_sock, (struct sockaddr *)&client_addr,
				 &client_addr_size);
	if (client_sock == -1) {
		perror("error on accepting");
		err = -1;
		goto out_server;
	}

	// Send data N times and record time
	for (int i = 0; i < rounds; i++) {
		snprintf(data, 11, "%010d", i);
		data[10] = 'A';
		if (write(client_sock, data, data_size_kb * 1024) == -1) {
			perror("error on writing");
			err = -1;
			goto out_client;
		}

		gettimeofday(&tv, NULL);
		tm_now = localtime(&tv.tv_sec);
		strftime(formatted_time, sizeof(formatted_time), "%H:%M:%S",
			 tm_now);

		printf("%s.%06ld - Round %d: sending completed\n",
		       formatted_time, tv.tv_usec, (i + 1));
	}

	// Close sockets
out_client:
	close(client_sock);
out_server:
	close(server_sock);
	gettimeofday(&tv, NULL);
	tm_now = localtime(&tv.tv_sec);
	strftime(formatted_time, sizeof(formatted_time), "%H:%M:%S", tm_now);
	printf("%s.%06ld - server_sock closed\n", formatted_time, tv.tv_usec);

out_data:
	free(data);

	return err;
}