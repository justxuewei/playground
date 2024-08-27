#include <fcntl.h>
#include <aio.h>
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/uio.h>

char *buf2 = "abcdefghij";
char buf1[32];
char buf3[32];
char *raw_data = "00000000001111111111222222222233333333334444444444";
char raw_data1[1024];

int init()
{
    int fd, n;

    fd = open("aio-data", O_RDWR | O_CREAT, 0644);
	if (fd <= 0) {
		perror("error on opening file");
		return -1;
	}

	n = write(fd, raw_data, strlen(raw_data));
	if (n <= 0) {
		perror("error on writing raw data");
		return -1;
	}
    n = pread(fd, raw_data1, sizeof(raw_data1), 0);
	printf("wrote %d bytes: %s\n", n, raw_data1);

    return fd;
}

void aio_hdlr(int signo)
{
	printf("buf1 = %.10s\n", buf1);
	printf("buf3 = %.10s\n", buf3);
}

int main(int argc, char *argv[])
{
	struct sigaction act;
	struct sigevent sevp;
	struct aiocb *list_aio[3];
	struct aiocb aio1, aio2, aio3;
	int err, fd;

	fd = init();
    if (fd < 0) {
        perror("error on initing");
        return 1;
    }

	aio1.aio_fildes = fd;
	aio1.aio_lio_opcode = LIO_READ;
	aio1.aio_buf = buf1;
	aio1.aio_offset = 10;
	aio1.aio_nbytes = 10;
	aio1.aio_reqprio = 0;

	aio2.aio_fildes = fd;
	aio2.aio_lio_opcode = LIO_WRITE;
	aio2.aio_buf = buf2;
	aio2.aio_offset = 20;
	aio2.aio_nbytes = 10;
	aio2.aio_reqprio = 0;

	aio3.aio_fildes = fd;
	aio3.aio_lio_opcode = LIO_READ;
	aio3.aio_buf = buf3;
	aio3.aio_offset = 30;
	aio3.aio_nbytes = 10;
	aio3.aio_reqprio = 0;

	list_aio[0] = &aio1;
	list_aio[1] = &aio2;
	list_aio[2] = &aio3;

	memset(&act, 0, sizeof(act));
	act.sa_handler = aio_hdlr;
	sigaction(SIGUSR1, &act, NULL);
    /* Ignore SIGHUP signal */
	act.sa_handler = SIG_IGN;
	sigaction(SIGHUP, &act, NULL);

	/* After IO operations finsin, a SIGUSR1 signal is sent. */
	memset(&sevp, 0, sizeof(sevp));
	sevp.sigev_signo = SIGUSR1;
	sevp.sigev_notify = SIGEV_SIGNAL;
	sevp.sigev_value.sival_ptr = (void *)list_aio;

	err = lio_listio(LIO_NOWAIT, list_aio, 3, &sevp);
	if (err) {
		perror("error on lio_listio");
		return 1;
	}

	/* Once the signal handler runs, it returns. */
	pause();
}
