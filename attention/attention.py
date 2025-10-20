import math
from dataclasses import dataclass

import torch
import torch.nn as nn


@dataclass
class ModelArgs:
    hidden_size: int = 4096
    head_num = 32


class MultiHeadAttentionBlock(nn.Module):
    def __init__(self, model_args: ModelArgs):
        super().__init__()
        # embedding size (a.k.a. d_model)
        self.hidden_size = model_args.hidden_size
        # number of attention heads
        self.head_num = model_args.head_num
        assert self.hidden_size % self.head_num == 0, "d_model is not divisible by h"

        # dimension of each attention head
        self.d_k = self.hidden_size // self.head_num
        # Wq
        self.w_q = nn.Linear(self.hidden_size, self.hidden_size, bias=False)
        # Wk
        self.w_k = nn.Linear(self.hidden_size, self.hidden_size, bias=False)
        # Wv
        self.w_v = nn.Linear(self.hidden_size, self.hidden_size, bias=False)
        # Wo
        self.w_o = nn.Linear(self.hidden_size, self.hidden_size, bias=False)

    @staticmethod
    # Dimension of the following args:
    #   (batch_size, head_num, seq_len, d_k)
    def attention(query: torch.Tensor, key: torch.Tensor, value: torch.Tensor):
        # query.shape = (batch_size, head_num, seq_len, d_k)
        # query.shape[-1] is d_k
        d_k = query.shape[-1]
        # key.transpose(-2, -1) means transposing the last two
        # dimensions:
        # (batch_size, head_num, d_k, seq_len) ->
        #           (batch_size, head_num, seq_len, d_k)
        # The query shape is (batch_size, head_num, seq_len, d_k),
        # transposing is required to dot product.
        # head1 = Q1 * K1^T / sqrt(d_k)
        # head2 = Q2 * K2^T / sqrt(d_k)
        # ...
        # attention_scores = concat(head1, head2, ...)
        # attention_scores shape: (batch_size, head_num, seq_len, seq_len)
        attention_scores = (query @ key.transpose(-2, -1)) / math.sqrt(d_k)
        # ignore multi-head and batch, the shape is (seq_len, seq_len)
        # dim=-1 means softmax is applied to each row, sum of each row
        # is 1, i.e. scores[0][0] + scores[0][1] + ... = 1
        attention_scores = attention_scores.softmax(dim=-1)

        # 0: (batch_size, head_num, seq_len, d_k)
        # 1: (batch_size, head_num, seq_len, seq_len)
        return (attention_scores @ value), attention_scores

    # x: (batch_size, seq_len, hidden_size)
    def forward(self, x: torch.Tensor):
        # equivalent to: x @ self.w_q
        # query: (batch_size, seq_len, hidden_size)
        query = self.w_q(x)
        key = self.w_k(x)
        value = self.w_v(x)

        # query.view reshapes the tensor without changing data. The
        # shape is (batch_size, seq_len, head_num, d_k)
        # transpose(1, 2) swaps the 2nd and 3rd dimensions, so the
        # final shape is (batch_size, head_num, seq_len, d_k)
        query = query.view(
            query.shape[0], query.shape[1], self.head_num, self.d_k
        ).transpose(1, 2)
        key = key.view(key.shape[0], key.shape[1], self.head_num, self.d_k).transpose(
            1, 2
        )
        value = value.view(
            value.shape[0], value.shape[1], self.head_num, self.d_k
        ).transpose(1, 2)

        # Q dot K^T / sqrt(d_k)
        x, self.attention_scores = MultiHeadAttentionBlock.attention(query, key, value)

        # concatenate all heads together
        # x: (batch_size, seq_len, hidden_size)
        x = (
            x.transpose(1, 2)
            .contiguous()
            .view(x.shape[0], -1, self.head_num * self.d_k)
        )

        # (Q dot K^T / sqrt(d_k)) dot V
        # returned x: (batch_size, seq_len, hidden_size)
        return self.w_o(x)


if __name__ == "__main__":
    torch.manual_seed(42)
    model_args = ModelArgs()
    model = MultiHeadAttentionBlock(model_args)

    batch_size = 1
    seq_len = 5

    seq_input = torch.randn(batch_size, seq_len, model_args.hidden_size)
    print(model(seq_input))
