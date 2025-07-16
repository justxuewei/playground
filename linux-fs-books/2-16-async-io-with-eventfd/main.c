// This code is copied from
// https://github.com/jakm/twisted-linux-aio/blob/master/examples/eventfd-aio-test.c

/*
 *  eventfd-aio-test by Davide Libenzi (test app for eventfd hooked into KAIO)
 *  Copyright (C) 2007  Davide Libenzi
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 *
 *  Davide Libenzi <davidel@xmailserver.org>
 *
 */

// Define _GNU_SOURCE before including any header files, it allows you to
// use additional functions and features that are not part of the standard
// C library but are provided by glibc.
#define _GNU_SOURCE
#include <sys/syscall.h>
#include <sys/types.h>
#include <sys/signal.h>
#include <sys/time.h>
#include <sys/uio.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <poll.h>
#include <fcntl.h>
#include <time.h>
#include <errno.h>

#define __NR_eventfd 284

#if defined(__LITTLE_ENDIAN)
#define PADDED(x, y) x, y;
#elif defined(__BIG_ENDIAN)
#define PADDED(x, y) y, x;
#else
#error edit for your odd byteorder.
#endif

// If c isn't 0, then the expression would be `char[-1]`, which makes an
// error when compiling.
#define BUILD_BUG_IF(c) ((void)sizeof(char[1 - 2 * !!(c)]))

#define IOCB_FLAG_RESFD (1 << 0)

typedef unsigned long aio_context_t;

enum {
	IOCB_CMD_PREAD = 0,
	IOCB_CMD_PWRITE = 1,
	IOCB_CMD_FSYNC = 2,
	IOCB_CMD_FDSYNC = 3,
	/* These two are experimental, 
	 * IOCB_CMD_PREADX = 4,
	 * IOCB_CMD_POLL = 5,
	*/
	IOCB_CMD_NOOP = 6,
	IOCB_CMD_PREADV = 7,
	IOCB_CMD_PWRITEV = 8,
};

// See https://man7.org/linux/man-pages/man7/aio.7.html for detailed
// definitions.
struct iocb {
	u_int64_t aio_data;
	u_int32_t PADDED(aio_key, aio_reserved1);

	u_int16_t aio_lio_opcode; /* Operation to be performed; lio_listio() only */
	int16_t aio_reqprio; /* Request priority */
	u_int32_t aio_fildes; /* File descriptor */

	u_int64_t aio_buf; /* Location of buffer */
	u_int64_t aio_nbytes; /* Length of transfer */
	int64_t aio_offset;

	u_int64_t aio_reserved2;

	u_int32_t aio_flags;

	u_int32_t aio_resfd;
}; /* 64 bytes */

struct io_event {
	u_int64_t data;
	u_int64_t obj;
	int64_t res;
	int64_t res2;
};

static void asyio_prep_preadv(struct iocb *iocb, int fd, struct iovec *iov,
			      int nr_segs, int64_t offset, int afd)
{
	memset(iocb, 0, sizeof(*iocb));
	iocb->aio_fildes = fd;
	iocb->aio_lio_opcode = IOCB_CMD_PREADV;
	iocb->aio_reqprio = 0;
	iocb->aio_buf = (u_int64_t)iov;
	iocb->aio_nbytes = nr_segs;
	iocb->aio_offset = offset;
	iocb->aio_flags = IOCB_FLAG_RESFD;
	iocb->aio_resfd = afd;
}

static void asyio_prep_pread(struct iocb *iocb, int fd, struct iovec *iov,
			     int nr_segs, int64_t offset, int afd)
{
	memset(iocb, 0, sizeof(*iocb));
	iocb->aio_fildes = fd;
	iocb->aio_lio_opcode = IOCB_CMD_PWRITEV;
	iocb->aio_reqprio = 0;
	iocb->aio_buf = (u_int64_t)iov;
	iocb->aio_nbytes = nr_segs;
	iocb->aio_offset = offset;
	iocb->aio_flags = IOCB_FLAG_RESFD;
	iocb->aio_resfd = afd;
}

static void asyio_prep_pread(struct iocb *iocb, int fd, void *buf, int nr_segs,
			     int64_t offset, int afd)
{
	memset(iocb, 0, sizeof(*iocb));
	iocb->aio_fildes = fd;
	iocb->aio_lio_opcode = IOCB_CMD_PREAD;
	iocb->aio_reqprio = 0;
	iocb->aio_buf = (u_int64_t)buf;
	iocb->aio_nbytes = nr_segs;
	iocb->aio_offset = offset;
	iocb->aio_flags = IOCB_FLAG_RESFD;
	iocb->aio_resfd = afd;
}

static void asyio_prep_pwrite(struct iocb *iocb, int fd, void const *buf,
			      int nr_segs, int64_t offset, int afd)
{
	memset(iocb, 0, sizeof(*iocb));
	iocb->aio_fildes = fd;
	iocb->aio_lio_opcode = IOCB_CMD_PWRITE;
	iocb->aio_reqprio = 0;
	iocb->aio_buf = (u_int64_t)buf;
	iocb->aio_nbytes = nr_segs;
	iocb->aio_offset = offset;
	iocb->aio_flags = IOCB_FLAG_RESFD;
	iocb->aio_resfd = afd;
}

static long io_setup(unsigned nr_reqs, aio_context_t *ctx) {
	return syscall(__NR_io_setup, nr_reqs, ctx);
}

static long io_destroy(aio_context_t ctx) {
	return syscall(__NR_io_destroy, ctx);
}

static long io_submit(aio_context_t ctx, long n, struct iocb **paiocb) {
	return syscall(__NR_io_submit, ctx, n, paiocb);
}

int main()
{
	return 0;
}
