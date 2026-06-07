package com.conviction.dca.strategy;

import com.conviction.dca.dto.DCAInput;
import com.conviction.dca.dto.DCARecommendation;

public interface DCARecommendationStrategy {

    String getName();

    DCARecommendation recommend(DCAInput input);
}
