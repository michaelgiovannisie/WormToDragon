package com.conviction.auth.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String username,
        Boolean active,
        LocalDateTime createdAt
) {
}