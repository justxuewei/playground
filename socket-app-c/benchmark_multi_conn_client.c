#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/time.h>
#include <time.h>

void error_handling(const char *message)
{
	perror(message);
	exit(1);
}

long long get_time_in_microseconds()
{
	struct timeval tv;
	gettimeofday(&tv, NULL);
	return tv.tv_sec * 1000000LL + tv.tv_usec;
}

int main(int argc, char *argv[])
{
	if (argc != 4) {
		printf("Usage: %s <IP> <Port> <Data size (KB)>\n", argv[0]);
		exit(1);
	}

	char *ip = argv[1];
	int port = atoi(argv[2]);
	int data_size_kb = atoi(argv[3]);

	int sock, recv_len, total_recv_len, rounds;
	struct sockaddr_in server_addr;
	char *buffer, *data;
	struct timeval tv;
	struct tm *tm_now;
	char formatted_time[24];
	long long start_time, end_time, total_bytes_received = 0,
					total_time_elapsed = 0;

	// Create buffer for receiving data
	buffer = malloc(data_size_kb * 1024);
	if (buffer == NULL) {
		error_handling("malloc buffer error");
	}
	data = malloc(data_size_kb * 1024);
	if (data == NULL) {
		error_handling("malloc data error");
	}

	while (1) {
		// Create socket
		sock = socket(AF_INET, SOCK_STREAM, 0);
		if (sock == -1) {
			error_handling("socket() error");
		}

		memset(&server_addr, 0, sizeof(server_addr));
		server_addr.sin_family = AF_INET;
		server_addr.sin_addr.s_addr = inet_addr(ip);
		server_addr.sin_port = htons(port);

		if (connect(sock, (struct sockaddr *)&server_addr,
			    sizeof(server_addr)) == -1) {
			perror("error on connecting");
			break;
		}

		start_time = get_time_in_microseconds();
		// Reset
		memset(data, 0, data_size_kb * 1024);
		total_recv_len = 0;

		while ((recv_len = read(sock, buffer, data_size_kb * 1024)) >
		       0) {
			memcpy(data, buffer + total_recv_len, recv_len);
			total_recv_len += recv_len;
		}

		end_time = get_time_in_microseconds();

		long long elapsed_time =
			end_time - start_time; // Unit: microseconds

		sscanf(data, "%10d", &rounds);

		gettimeofday(&tv, NULL);
		tm_now = localtime(&tv.tv_sec);
		strftime(formatted_time, sizeof(formatted_time), "%H:%M:%S",
			 tm_now);

		printf("%s.%06ld - Round %d: Bytes received = %.2f KB\n",
		       formatted_time, tv.tv_usec, (rounds + 1),
		       (total_recv_len / 1024.0));

		total_bytes_received += total_recv_len;
		total_time_elapsed += elapsed_time;

		close(sock);
	}

	double average_speed = (total_bytes_received / (1024.0 * 1024)) /
			       (total_time_elapsed / 1000000.0); // Unit: MB/s
	printf("Total bytes received: %.2f KB, Total time elapsed: %lld us, Average speed: %.6f MB/s\n",
	       (total_bytes_received / 1024.0), total_time_elapsed,
	       average_speed);

	free(buffer);
	free(data);

	return 0;
}
