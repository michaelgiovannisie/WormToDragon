package com.conviction.account.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.conviction.account.entity.Account;

public interface AccountRepository extends JpaRepository<Account, UUID> {

    List<Account> findByPortfolioId(UUID portfolioId);

    List<Account> findByPortfolioIdAndActiveTrue(UUID portfolioId);
}