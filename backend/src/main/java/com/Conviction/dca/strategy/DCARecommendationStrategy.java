package com.conviction.dca.strategy;

import com.conviction.dca.dto.DCAInput;
import com.conviction.dca.dto.DCARecommendation;

/** @deprecated Replaced by ConvictionDCAStrategy. Safe to delete this file and its implementations. */
@Deprecated
public interface DCARecommendationStrategy {

    String getName();

    DCARecommendation recommend(DCAInput input);
}
