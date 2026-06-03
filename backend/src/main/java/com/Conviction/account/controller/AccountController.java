package com.conviction.account.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.account.dto.AccountResponse;
import com.conviction.account.dto.CreateAccountRequest;
import com.conviction.account.service.AccountService;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @PostMapping
    public AccountResponse createAccount(@RequestBody CreateAccountRequest request) {
        return accountService.createAccount(request);
    }

    @GetMapping("/portfolio/{portfolioId}")
    public List<AccountResponse> getAccountsByPortfolioId(@PathVariable UUID portfolioId) {
        return accountService.getAccountsByPortfolioId(portfolioId);
    }
}