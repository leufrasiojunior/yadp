import React from 'react'
import { HistoryChart, HistoryEntry } from './chart'

const dataRaw = [
    {
        "timestamp": 1751930100,
        "total": 99,
        "cached": 68,
        "blocked": 12,
        "forwarded": 16
    },
    {
        "timestamp": 1751930700,
        "total": 215,
        "cached": 120,
        "blocked": 54,
        "forwarded": 37
    },
    {
        "timestamp": 1751931300,
        "total": 369,
        "cached": 331,
        "blocked": 20,
        "forwarded": 16
    },
    {
        "timestamp": 1751931900,
        "total": 108,
        "cached": 53,
        "blocked": 28,
        "forwarded": 24
    },
    {
        "timestamp": 1751932500,
        "total": 229,
        "cached": 104,
        "blocked": 35,
        "forwarded": 86
    },
    {
        "timestamp": 1751933100,
        "total": 190,
        "cached": 71,
        "blocked": 54,
        "forwarded": 62
    },
    {
        "timestamp": 1751933700,
        "total": 103,
        "cached": 73,
        "blocked": 12,
        "forwarded": 16
    },
    {
        "timestamp": 1751934300,
        "total": 57,
        "cached": 29,
        "blocked": 12,
        "forwarded": 14
    },
    {
        "timestamp": 1751934900,
        "total": 421,
        "cached": 319,
        "blocked": 16,
        "forwarded": 82
    },
    {
        "timestamp": 1751935500,
        "total": 218,
        "cached": 100,
        "blocked": 38,
        "forwarded": 74
    },
    {
        "timestamp": 1751936100,
        "total": 133,
        "cached": 52,
        "blocked": 51,
        "forwarded": 28
    },
    {
        "timestamp": 1751936700,
        "total": 126,
        "cached": 65,
        "blocked": 37,
        "forwarded": 22
    },
    {
        "timestamp": 1751937300,
        "total": 189,
        "cached": 100,
        "blocked": 35,
        "forwarded": 52
    },
    {
        "timestamp": 1751937900,
        "total": 227,
        "cached": 114,
        "blocked": 31,
        "forwarded": 80
    },
    {
        "timestamp": 1751938500,
        "total": 332,
        "cached": 300,
        "blocked": 14,
        "forwarded": 15
    },
    {
        "timestamp": 1751939100,
        "total": 232,
        "cached": 96,
        "blocked": 82,
        "forwarded": 50
    },
    {
        "timestamp": 1751939700,
        "total": 1117,
        "cached": 108,
        "blocked": 916,
        "forwarded": 85
    },
    {
        "timestamp": 1751940300,
        "total": 1100,
        "cached": 158,
        "blocked": 913,
        "forwarded": 27
    },
    {
        "timestamp": 1751940900,
        "total": 525,
        "cached": 134,
        "blocked": 336,
        "forwarded": 52
    },
    {
        "timestamp": 1751941500,
        "total": 221,
        "cached": 84,
        "blocked": 103,
        "forwarded": 32
    },
    {
        "timestamp": 1751942100,
        "total": 413,
        "cached": 334,
        "blocked": 37,
        "forwarded": 39
    },
    {
        "timestamp": 1751942700,
        "total": 228,
        "cached": 95,
        "blocked": 0,
        "forwarded": 124
    },
    {
        "timestamp": 1751943300,
        "total": 235,
        "cached": 135,
        "blocked": 0,
        "forwarded": 94
    },
    {
        "timestamp": 1751943900,
        "total": 150,
        "cached": 90,
        "blocked": 0,
        "forwarded": 54
    },
    {
        "timestamp": 1751944500,
        "total": 143,
        "cached": 58,
        "blocked": 1,
        "forwarded": 80
    },
    {
        "timestamp": 1751945100,
        "total": 62,
        "cached": 13,
        "blocked": 4,
        "forwarded": 43
    },
    {
        "timestamp": 1751945700,
        "total": 297,
        "cached": 265,
        "blocked": 14,
        "forwarded": 16
    },
    {
        "timestamp": 1751946300,
        "total": 44,
        "cached": 18,
        "blocked": 11,
        "forwarded": 13
    },
    {
        "timestamp": 1751946900,
        "total": 39,
        "cached": 6,
        "blocked": 11,
        "forwarded": 20
    },
    {
        "timestamp": 1751947500,
        "total": 41,
        "cached": 20,
        "blocked": 11,
        "forwarded": 8
    },
    {
        "timestamp": 1751948100,
        "total": 57,
        "cached": 33,
        "blocked": 10,
        "forwarded": 12
    },
    {
        "timestamp": 1751948700,
        "total": 62,
        "cached": 16,
        "blocked": 21,
        "forwarded": 23
    },
    {
        "timestamp": 1751949300,
        "total": 272,
        "cached": 261,
        "blocked": 9,
        "forwarded": 0
    },
    {
        "timestamp": 1751949900,
        "total": 83,
        "cached": 42,
        "blocked": 13,
        "forwarded": 26
    },
    {
        "timestamp": 1751950500,
        "total": 30,
        "cached": 14,
        "blocked": 13,
        "forwarded": 1
    },
    {
        "timestamp": 1751951100,
        "total": 32,
        "cached": 19,
        "blocked": 10,
        "forwarded": 1
    },
    {
        "timestamp": 1751951700,
        "total": 45,
        "cached": 33,
        "blocked": 9,
        "forwarded": 1
    },
    {
        "timestamp": 1751952300,
        "total": 19,
        "cached": 8,
        "blocked": 9,
        "forwarded": 0
    },
    {
        "timestamp": 1751952900,
        "total": 278,
        "cached": 264,
        "blocked": 9,
        "forwarded": 3
    },
    {
        "timestamp": 1751953500,
        "total": 81,
        "cached": 20,
        "blocked": 39,
        "forwarded": 20
    },
    {
        "timestamp": 1751954100,
        "total": 24,
        "cached": 11,
        "blocked": 7,
        "forwarded": 4
    },
    {
        "timestamp": 1751954700,
        "total": 57,
        "cached": 36,
        "blocked": 1,
        "forwarded": 17
    },
    {
        "timestamp": 1751955300,
        "total": 40,
        "cached": 35,
        "blocked": 1,
        "forwarded": 0
    },
    {
        "timestamp": 1751955900,
        "total": 7,
        "cached": 5,
        "blocked": 0,
        "forwarded": 0
    },
    {
        "timestamp": 1751956500,
        "total": 268,
        "cached": 264,
        "blocked": 1,
        "forwarded": 1
    },
    {
        "timestamp": 1751957100,
        "total": 28,
        "cached": 14,
        "blocked": 8,
        "forwarded": 4
    },
    {
        "timestamp": 1751957700,
        "total": 22,
        "cached": 4,
        "blocked": 12,
        "forwarded": 4
    },
    {
        "timestamp": 1751958300,
        "total": 521,
        "cached": 121,
        "blocked": 184,
        "forwarded": 211
    },
    {
        "timestamp": 1751958900,
        "total": 213,
        "cached": 84,
        "blocked": 102,
        "forwarded": 22
    },
    {
        "timestamp": 1751959500,
        "total": 91,
        "cached": 21,
        "blocked": 54,
        "forwarded": 13
    },
    {
        "timestamp": 1751960100,
        "total": 283,
        "cached": 267,
        "blocked": 12,
        "forwarded": 2
    },
    {
        "timestamp": 1751960700,
        "total": 37,
        "cached": 21,
        "blocked": 14,
        "forwarded": 0
    },
    {
        "timestamp": 1751961300,
        "total": 81,
        "cached": 23,
        "blocked": 41,
        "forwarded": 15
    },
    {
        "timestamp": 1751961900,
        "total": 48,
        "cached": 30,
        "blocked": 12,
        "forwarded": 4
    },
    {
        "timestamp": 1751962500,
        "total": 45,
        "cached": 35,
        "blocked": 8,
        "forwarded": 0
    },
    {
        "timestamp": 1751963100,
        "total": 24,
        "cached": 8,
        "blocked": 10,
        "forwarded": 4
    },
    {
        "timestamp": 1751963700,
        "total": 281,
        "cached": 263,
        "blocked": 8,
        "forwarded": 8
    },
    {
        "timestamp": 1751964300,
        "total": 30,
        "cached": 14,
        "blocked": 13,
        "forwarded": 2
    },
    {
        "timestamp": 1751964900,
        "total": 26,
        "cached": 10,
        "blocked": 9,
        "forwarded": 5
    },
    {
        "timestamp": 1751965500,
        "total": 95,
        "cached": 27,
        "blocked": 28,
        "forwarded": 36
    },
    {
        "timestamp": 1751966100,
        "total": 56,
        "cached": 36,
        "blocked": 14,
        "forwarded": 4
    },
    {
        "timestamp": 1751966700,
        "total": 18,
        "cached": 6,
        "blocked": 10,
        "forwarded": 0
    },
    {
        "timestamp": 1751967300,
        "total": 275,
        "cached": 265,
        "blocked": 8,
        "forwarded": 0
    },
    {
        "timestamp": 1751967900,
        "total": 149,
        "cached": 33,
        "blocked": 16,
        "forwarded": 98
    },
    {
        "timestamp": 1751968500,
        "total": 185,
        "cached": 79,
        "blocked": 25,
        "forwarded": 79
    },
    {
        "timestamp": 1751969100,
        "total": 557,
        "cached": 189,
        "blocked": 30,
        "forwarded": 329
    },
    {
        "timestamp": 1751969700,
        "total": 129,
        "cached": 71,
        "blocked": 11,
        "forwarded": 44
    },
    {
        "timestamp": 1751970300,
        "total": 62,
        "cached": 29,
        "blocked": 9,
        "forwarded": 22
    },
    {
        "timestamp": 1751970900,
        "total": 276,
        "cached": 266,
        "blocked": 8,
        "forwarded": 0
    },
    {
        "timestamp": 1751971500,
        "total": 26,
        "cached": 14,
        "blocked": 9,
        "forwarded": 1
    },
    {
        "timestamp": 1751972100,
        "total": 24,
        "cached": 8,
        "blocked": 13,
        "forwarded": 1
    },
    {
        "timestamp": 1751972700,
        "total": 34,
        "cached": 22,
        "blocked": 9,
        "forwarded": 1
    },
    {
        "timestamp": 1751973300,
        "total": 144,
        "cached": 56,
        "blocked": 27,
        "forwarded": 57
    },
    {
        "timestamp": 1751973900,
        "total": 73,
        "cached": 16,
        "blocked": 40,
        "forwarded": 15
    },
    {
        "timestamp": 1751974500,
        "total": 332,
        "cached": 277,
        "blocked": 35,
        "forwarded": 18
    },
    {
        "timestamp": 1751975100,
        "total": 35,
        "cached": 15,
        "blocked": 13,
        "forwarded": 6
    },
    {
        "timestamp": 1751975700,
        "total": 208,
        "cached": 84,
        "blocked": 47,
        "forwarded": 68
    },
    {
        "timestamp": 1751976300,
        "total": 1010,
        "cached": 493,
        "blocked": 129,
        "forwarded": 375
    },
    {
        "timestamp": 1751976900,
        "total": 160,
        "cached": 85,
        "blocked": 31,
        "forwarded": 42
    },
    {
        "timestamp": 1751977500,
        "total": 817,
        "cached": 509,
        "blocked": 66,
        "forwarded": 230
    },
    {
        "timestamp": 1751978100,
        "total": 775,
        "cached": 551,
        "blocked": 55,
        "forwarded": 163
    },
    {
        "timestamp": 1751978700,
        "total": 226,
        "cached": 104,
        "blocked": 42,
        "forwarded": 75
    },
    {
        "timestamp": 1751979300,
        "total": 130,
        "cached": 68,
        "blocked": 27,
        "forwarded": 32
    },
    {
        "timestamp": 1751979900,
        "total": 150,
        "cached": 91,
        "blocked": 20,
        "forwarded": 37
    },
    {
        "timestamp": 1751980500,
        "total": 189,
        "cached": 123,
        "blocked": 24,
        "forwarded": 40
    },
    {
        "timestamp": 1751981100,
        "total": 120,
        "cached": 64,
        "blocked": 19,
        "forwarded": 35
    },
    {
        "timestamp": 1751981700,
        "total": 379,
        "cached": 327,
        "blocked": 15,
        "forwarded": 35
    },
    {
        "timestamp": 1751982300,
        "total": 165,
        "cached": 97,
        "blocked": 22,
        "forwarded": 44
    },
    {
        "timestamp": 1751982900,
        "total": 345,
        "cached": 184,
        "blocked": 43,
        "forwarded": 99
    },
    {
        "timestamp": 1751983500,
        "total": 423,
        "cached": 355,
        "blocked": 17,
        "forwarded": 49
    },
    {
        "timestamp": 1751984100,
        "total": 187,
        "cached": 127,
        "blocked": 29,
        "forwarded": 29
    },
    {
        "timestamp": 1751984700,
        "total": 244,
        "cached": 155,
        "blocked": 47,
        "forwarded": 40
    },
    {
        "timestamp": 1751985300,
        "total": 647,
        "cached": 460,
        "blocked": 88,
        "forwarded": 97
    },
    {
        "timestamp": 1751985900,
        "total": 332,
        "cached": 158,
        "blocked": 86,
        "forwarded": 86
    },
    {
        "timestamp": 1751986500,
        "total": 185,
        "cached": 107,
        "blocked": 27,
        "forwarded": 46
    },
    {
        "timestamp": 1751987100,
        "total": 209,
        "cached": 97,
        "blocked": 31,
        "forwarded": 77
    },
    {
        "timestamp": 1751987700,
        "total": 393,
        "cached": 253,
        "blocked": 61,
        "forwarded": 75
    },
    {
        "timestamp": 1751988300,
        "total": 324,
        "cached": 179,
        "blocked": 69,
        "forwarded": 71
    },
    {
        "timestamp": 1751988900,
        "total": 525,
        "cached": 435,
        "blocked": 39,
        "forwarded": 48
    },
    {
        "timestamp": 1751989500,
        "total": 318,
        "cached": 195,
        "blocked": 56,
        "forwarded": 61
    },
    {
        "timestamp": 1751990100,
        "total": 506,
        "cached": 231,
        "blocked": 115,
        "forwarded": 148
    },
    {
        "timestamp": 1751990700,
        "total": 531,
        "cached": 311,
        "blocked": 75,
        "forwarded": 138
    },
    {
        "timestamp": 1751991300,
        "total": 273,
        "cached": 200,
        "blocked": 27,
        "forwarded": 44
    },
    {
        "timestamp": 1751991900,
        "total": 243,
        "cached": 173,
        "blocked": 27,
        "forwarded": 41
    },
    {
        "timestamp": 1751992500,
        "total": 557,
        "cached": 468,
        "blocked": 39,
        "forwarded": 47
    },
    {
        "timestamp": 1751993100,
        "total": 257,
        "cached": 183,
        "blocked": 31,
        "forwarded": 39
    },
    {
        "timestamp": 1751993700,
        "total": 317,
        "cached": 187,
        "blocked": 74,
        "forwarded": 54
    },
    {
        "timestamp": 1751994300,
        "total": 327,
        "cached": 215,
        "blocked": 53,
        "forwarded": 57
    },
    {
        "timestamp": 1751994900,
        "total": 287,
        "cached": 202,
        "blocked": 33,
        "forwarded": 49
    },
    {
        "timestamp": 1751995500,
        "total": 238,
        "cached": 166,
        "blocked": 33,
        "forwarded": 37
    },
    {
        "timestamp": 1751996100,
        "total": 489,
        "cached": 413,
        "blocked": 24,
        "forwarded": 50
    },
    {
        "timestamp": 1751996700,
        "total": 223,
        "cached": 162,
        "blocked": 27,
        "forwarded": 33
    },
    {
        "timestamp": 1751997300,
        "total": 525,
        "cached": 226,
        "blocked": 159,
        "forwarded": 133
    },
    {
        "timestamp": 1751997900,
        "total": 465,
        "cached": 241,
        "blocked": 118,
        "forwarded": 99
    },
    {
        "timestamp": 1751998500,
        "total": 379,
        "cached": 249,
        "blocked": 54,
        "forwarded": 72
    },
    {
        "timestamp": 1751999100,
        "total": 338,
        "cached": 213,
        "blocked": 50,
        "forwarded": 70
    },
    {
        "timestamp": 1751999700,
        "total": 603,
        "cached": 465,
        "blocked": 87,
        "forwarded": 46
    },
    {
        "timestamp": 1752000300,
        "total": 277,
        "cached": 191,
        "blocked": 57,
        "forwarded": 27
    },
    {
        "timestamp": 1752000900,
        "total": 234,
        "cached": 186,
        "blocked": 31,
        "forwarded": 14
    },
    {
        "timestamp": 1752001500,
        "total": 336,
        "cached": 241,
        "blocked": 32,
        "forwarded": 56
    },
    {
        "timestamp": 1752002100,
        "total": 197,
        "cached": 169,
        "blocked": 21,
        "forwarded": 5
    },
    {
        "timestamp": 1752002700,
        "total": 141,
        "cached": 119,
        "blocked": 14,
        "forwarded": 6
    },
    {
        "timestamp": 1752003300,
        "total": 485,
        "cached": 411,
        "blocked": 32,
        "forwarded": 38
    },
    {
        "timestamp": 1752003900,
        "total": 237,
        "cached": 169,
        "blocked": 32,
        "forwarded": 34
    },
    {
        "timestamp": 1752004500,
        "total": 360,
        "cached": 215,
        "blocked": 58,
        "forwarded": 82
    },
    {
        "timestamp": 1752005100,
        "total": 533,
        "cached": 301,
        "blocked": 147,
        "forwarded": 82
    },
    {
        "timestamp": 1752005700,
        "total": 286,
        "cached": 169,
        "blocked": 5,
        "forwarded": 110
    },
    {
        "timestamp": 1752006300,
        "total": 203,
        "cached": 165,
        "blocked": 0,
        "forwarded": 36
    },
    {
        "timestamp": 1752006900,
        "total": 460,
        "cached": 423,
        "blocked": 0,
        "forwarded": 31
    },
    {
        "timestamp": 1752007500,
        "total": 200,
        "cached": 168,
        "blocked": 0,
        "forwarded": 27
    },
    {
        "timestamp": 1752008100,
        "total": 245,
        "cached": 205,
        "blocked": 0,
        "forwarded": 34
    },
    {
        "timestamp": 1752008700,
        "total": 358,
        "cached": 244,
        "blocked": 0,
        "forwarded": 109
    },
    {
        "timestamp": 1752009300,
        "total": 228,
        "cached": 155,
        "blocked": 15,
        "forwarded": 56
    },
    {
        "timestamp": 1752009900,
        "total": 310,
        "cached": 169,
        "blocked": 26,
        "forwarded": 110
    },
    {
        "timestamp": 1752010500,
        "total": 505,
        "cached": 431,
        "blocked": 34,
        "forwarded": 38
    },
    {
        "timestamp": 1752011100,
        "total": 205,
        "cached": 153,
        "blocked": 15,
        "forwarded": 35
    },
    {
        "timestamp": 1752011700,
        "total": 208,
        "cached": 146,
        "blocked": 36,
        "forwarded": 24
    },
    {
        "timestamp": 1752012300,
        "total": 342,
        "cached": 184,
        "blocked": 64,
        "forwarded": 91
    },
    {
        "timestamp": 1752012900,
        "total": 254,
        "cached": 190,
        "blocked": 36,
        "forwarded": 25
    },
    {
        "timestamp": 1752013500,
        "total": 282,
        "cached": 208,
        "blocked": 34,
        "forwarded": 37
    },
    {
        "timestamp": 1752014100,
        "total": 473,
        "cached": 426,
        "blocked": 28,
        "forwarded": 17
    },
    {
        "timestamp": 1752014700,
        "total": 366,
        "cached": 228,
        "blocked": 46,
        "forwarded": 86
    },
    {
        "timestamp": 1752015300,
        "total": 796,
        "cached": 510,
        "blocked": 129,
        "forwarded": 145
    },
    {
        "timestamp": 1752015900,
        "total": 421,
        "cached": 228,
        "blocked": 98,
        "forwarded": 92
    },
    {
        "timestamp": 1752016500,
        "total": 661,
        "cached": 390,
        "blocked": 169,
        "forwarded": 99
    }
]

const data: HistoryEntry[] = dataRaw.map(({ timestamp, total, blocked }) => ({
    timestamp,
    total,
    blocked,
}))


function page() {
    return (
        <div><HistoryChart data={data} /></div>
    )
}

export default page