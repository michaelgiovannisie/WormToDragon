package com.conviction.auth.dto;

public record CreateUserRequest(
        String email,
        String username,
        String password
) {
}