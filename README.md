# mkrand-js
## A Digital Random Bit Generator

Version: 0.1.0

[![GitHubCI](https://github.com/unozerocode/mkrand-js/workflows/Node%20CI/badge.svg)](https://github.com/unozerocode/mkrand-js/actions?query=workflow%3A%22Node+CI%22)

Implements ReaderStream

The PSI format [<: :>] brackets around a 32-digit hexadecimal ASCII string is for visually representing a 128-bit block within MKRAND. Sequentiality is implied with this format, hence using it as a seed will produce a sequence of blocks deterministically generated from the given seed. 

When outputing a bitstream, MKRAND can produce binary or text output. Within the text output option, it can generate blocks with the PSI formatting brackets which is useful for delimiting blocks, or if desired, can output only hexadecimal.
