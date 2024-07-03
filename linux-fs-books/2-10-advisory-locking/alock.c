#include <unistd.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>

void mysig_hdlr(int signo) {
    printf("alock - got signal %d\n", signo);
    return;
}

int main() {
    struct flock lock;
    int fd;
    struct sigaction action;

    action.sa_handler = mysig_hdlr;
    // 初始化信号集
    sigemptyset(&action.sa_mask);
    action.sa_flags = 0;
    // 处理 SIGUSR1
    // 指向的 struct sigaction
    // NULL 表示不关心信号的前一个处理设置
    sigaction(SIGUSR1, &action, NULL);

    fd = open("hello", O_RDWR);

    lock.l_type = F_WRLCK;
    lock.l_whence = SEEK_SET;
    lock.l_start = 0;
    // 锁定全部的文件
    lock.l_len = 0;
    lock.l_pid = getpid();
    // F_SETLK 用于设置或释放一个锁
    fcntl(fd, F_SETLK, &lock);

    printf("alock - file now locked\n");
    // 睡眠直到有一个信号
    // 如果有对应的信号处理程序，则执行
    // 否则进程将被终止
    pause();
    lock.l_type = F_UNLCK;
    fcntl(fd, F_SETLK, &lock);
    printf("alock - file now unlocked\n");
}
