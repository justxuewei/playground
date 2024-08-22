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

	int sock;
	struct sockaddr_in server_addr;
	char *buffer, *data;
	struct timeval tv;
	struct tm *tm_now;
	char formatted_time[24];

	// Create buffer for receiving data
	buffer = malloc(data_size_kb * 1024);
	if (buffer == NULL) {
		error_handling("malloc buffer error");
	}
	data = malloc(data_size_kb * 1024);
	if (data == NULL) {
		error_handling("malloc data error");
	}

	// Create socket
	sock = socket(PF_INET, SOCK_STREAM, 0);
	if (sock == -1) {
		error_handling("socket() error");
	}

	memset(&server_addr, 0, sizeof(server_addr));
	server_addr.sin_family = AF_INET;
	server_addr.sin_addr.s_addr = inet_addr(ip);
	server_addr.sin_port = htons(port);

	// Connect to server
	if (connect(sock, (struct sockaddr *)&server_addr,
		    sizeof(server_addr)) == -1) {
		error_handling("connect() error");
	}

	// Receive data and record time
	long long total_bytes_received = 0, total_time_elapsed = 0, start_time,
		  end_time;
	int rounds = 0, recv_len, eof_offset = 0, total_recv_len;

	start_time = get_time_in_microseconds();
	while (1) {
		// reset data
		memset(data, 0, data_size_kb * 1024);
		if (eof_offset > 0) {
			memcpy(data, buffer + eof_offset,
			       recv_len - eof_offset);
			total_recv_len = (recv_len - eof_offset);
		} else {
			total_recv_len = 0;
		}

		// struct timeval start, end;
		// long duration;
		// gettimeofday(&start, NULL);
		while ((recv_len = read(sock, buffer, data_size_kb * 1024)) >
		       0) {
			// gettimeofday(&end, NULL);
			// duration = (end.tv_sec - start.tv_sec) * 1000000L + (end.tv_usec - start.tv_usec);

            // printf("recv_len: %d, took %ld us\n", recv_len, duration);

			int i;

			for (i = 0; i < recv_len; i++) {
				if (buffer[i] == '\0') {
					eof_offset = (i + 1);
					memcpy(data + total_recv_len, buffer,
					       eof_offset);
					total_recv_len += eof_offset;
					goto out_loop;
				}
			}

			memcpy(data + total_recv_len, buffer, recv_len);
			total_recv_len += recv_len;
            // gettimeofday(&start, NULL);
		}

out_loop:
		if (recv_len == -1) {
			error_handling("read() error");
		} else if (recv_len == 0) {
			break; // No more data
		}

		sscanf(data, "%10d", &rounds);

		gettimeofday(&tv, NULL);
		tm_now = localtime(&tv.tv_sec);
		strftime(formatted_time, sizeof(formatted_time), "%H:%M:%S",
			 tm_now);

		printf("%s.%06ld - Round %d: Bytes received = %.2f KB\n",
		       formatted_time, tv.tv_usec, (rounds + 1),
		       (total_recv_len / 1024.0));

		total_bytes_received += total_recv_len;
	}

	end_time = get_time_in_microseconds();
	total_time_elapsed = end_time - start_time;

	double average_speed = (total_bytes_received / (1024.0 * 1024)) /
			       (total_time_elapsed / 1000000.0); // Unit: MB/s
	printf("Total bytes received: %.2f KB, Total time elapsed: %lld us, Average speed: %.6f MB/s\n",
	       (total_bytes_received / 1024.0), total_time_elapsed,
	       average_speed);

	// Close socket and free buffer
	close(sock);
	free(buffer);
	free(data);

	return 0;
}
