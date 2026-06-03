package com.conviction.account.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.conviction.account.dto.AccountResponse;
import com.conviction.account.dto.CreateAccountRequest;
import com.conviction.account.entity.Account;
import com.conviction.account.repository.AccountRepository;
import com.conviction.portfolio.entity.Portfolio;
import com.conviction.portfolio.repository.PortfolioRepository;

@Service
public class AccountService {

    private final AccountRepository accountRepository;
    private final PortfolioRepository portfolioRepository;

    public AccountService(
            AccountRepository accountRepository,
            PortfolioRepository portfolioRepository
    ) {
        this.accountRepository = accountRepository;
        this.portfolioRepository = portfolioRepository;
    }

    public AccountResponse createAccount(CreateAccountRequest request) {
        Portfolio portfolio = portfolioRepository.findById(request.portfolioId())
                .orElseThrow(() -> new IllegalArgumentException("Portfolio not found"));

        Account account = new Account();
        account.setAccountName(request.accountName());
        account.setBrokerName(request.brokerName());
        account.setAccountType(request.accountType());
        account.setMaskedAccountNumber(request.maskedAccountNumber());
        account.setPortfolio(portfolio);

        Account savedAccount = accountRepository.save(account);

        return toResponse(savedAccount);
    }

    public List<AccountResponse> getAccountsByPortfolioId(UUID portfolioId) {
        return accountRepository.findByPortfolioIdAndActiveTrue(portfolioId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private AccountResponse toResponse(Account account) {
        return new AccountResponse(
                account.getId(),
                account.getAccountName(),
                account.getBrokerName(),
                account.getAccountType(),
                account.getMaskedAccountNumber(),
                account.getActive(),
                account.getPortfolio().getId(),
                account.getCreatedAt()
        );
    }
}