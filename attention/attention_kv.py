import math
from dataclasses import dataclass

import torch
import torch.nn as nn


@dataclass
class ModelArgs:
    hidden_size: int = 4096
    head_num = 32
    # KV cache
    max_batch_size: int = 32
    max_seq_len: int = 2048


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

        # cache for K: (max_batch_size, max_seq_len, head_num, d_k)
        self.cache_k = torch.zeros(
            (model_args.max_batch_size, model_args.max_seq_len, self.head_num, self.d_k)
        )
        # cache for V
        self.cache_v = torch.zeros(
            (model_args.max_batch_size, model_args.max_seq_len, self.head_num, self.d_k)
        )

    # Why can KV cache accelerate inference?
    #
    # The output for tokenN depends on:
    # - tokenN
    # - K0, K1, ..., K(N-1)
    # - V0, V1, ..., V(N-1)
    #
    # x: (batch_size, 1, hidden_size)
    def forward(self, x: torch.Tensor, start_pos: int):
        batch_size, seq_len, _ = x.shape

        # query/key/value: (batch_size, 1, hidden_size)
        query = self.w_q(x)
        key = self.w_k(x)
        value = self.w_v(x)

        # query/key/value: (batch_size, 1, head_num, d_k)
        query: torch.Tensor = query.view(batch_size, 1, self.head_num, self.d_k)
        # we are calculating K(start_pos)
        key: torch.Tensor = key.view(batch_size, 1, self.head_num, self.d_k)
        # we are calculating V(start_pos)
        value: torch.Tensor = value.view(batch_size, 1, self.head_num, self.d_k)

        # update cache
        #
        # start_pos = 0: entry0 = key0 (filled), entry1 = empty,
        #   entry2 = empty, ..., entry(seq_len-1) = empty
        # start_pos = 1: entry0 = key0 (filled), entry1 = key1(filled),
        #   entry2 = empty, ..., entry(seq_len) = empty
        #
        # K(start_pos) and V(start_pos) are calculated from the above
        # self.cache_k[:batch_size, 0] for K0,
        #   self.cache_k[:batch_size, 1] for K1, ...,
        #   self.cache_k[:batch_size, start_pos] for K(start_pos),
        #   self.cache_k[:batch_size, start_pos + 1: start_pos +
        #   seq_len] are still empty
        self.cache_k[:batch_size, start_pos : start_pos + seq_len] = key
        self.cache_v[:batch_size, start_pos : start_pos + seq_len] = value

        # keys/values: (batch_size, start_pos + seq_len, head_num, d_k)
        #
        # keys[:batch, start_pos: start_post + seq_len] are initialized
        # to empty
        keys = self.cache_k[:batch_size, : start_pos + seq_len]
        values = self.cache_v[:batch_size, : start_pos + seq_len]

        # query: (batch_size, head_num, 1, d_k)
        query = query.transpose(1, 2)
        # keys/values: (batch_size, head_num, start_pos + seq_len, d_k)
        keys = keys.transpose(1, 2)
        values = values.transpose(1, 2)

        # keys.transpose(2, 3): (batch_size, head_num, d_k, start_pos + seq_len)
        # scores: (batch_size, head_num, 1, start_pos + seq_len)
        scores = query @ keys.transpose(2, 3) / math.sqrt(self.d_k)
        scores = scores.softmax(dim=-1)

        # output: (batch_size, head_num, 1, d_k)
        output = scores @ values
        # output: (batch_size, 1, hidden_size)
        output = output.transpose(1, 2).contiguous().view(batch_size, seq_len, -1)

        # returned: (batch_size, 1, hidden_size)
        return self.w_o(output)


# seq_input: (batch_size, seq_len, hidden_size)
def generate_func_kv_cache(seq_input, model):
    _, seq_len, _ = seq_input.shape

    for i in range(seq_len):
        token = seq_input[:, i : i + 1, :]
        start_pos = i
        output = model(token, start_pos)

    return output


if __name__ == "__main__":
    torch.manual_seed(42)
    model_args = ModelArgs()
    model = MultiHeadAttentionBlock(model_args)

    batch_size = 1
    seq_len = 5

    seq_input = torch.randn(batch_size, seq_len, model_args.hidden_size)
    print(generate_func_kv_cache(seq_input, model))
